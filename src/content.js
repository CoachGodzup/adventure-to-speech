/* Adventure To Speech - content script
 * Watches the Parchment page (iplayif.com) and reads the output
 * command after command using speechSynthesis (OS TTS voices).
 */
(() => {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    autoRead: true,
    voiceURI: '',
    lang: 'it-IT',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    speakCommands: true,      // also re-read the echoed typed command
    onlyMainWindow: true,     // ignore GridWindow (status bar)
    chunkSize: 220,
    debounceMs: 600,
    skipEmptyPrompt: true,
    ttsBackend: 'os',         // 'os' (speechSynthesis) or 'kokoro' (local neural, experimental)
    kokoroVoice: 'af_heart',  // Kokoro voices are English-only (see docs/08-kokoro.md)
    siteVoices: {}            // host -> voiceURI override (e.g. English voice for
                              // Counterfeit Monkey, Italian voice for Ghost Layer)
  };

  let settings = { ...DEFAULTS };
  let spokenNodes = new WeakSet();
  let lastLineCount = 0;
  let debounceTimer = null;
  let speakQueue = [];
  let isSpeakingSequence = false;
  let voices = [];
  let floatingBtn = null;

  // ---------- settings ----------
  const storage = (typeof chrome !== 'undefined' && chrome.storage) ||
                  (typeof browser !== 'undefined' && browser.storage) || null;

  async function loadSettings() {
    if (!storage) return;
    try {
      const stored = await storage.sync.get(DEFAULTS);
      settings = { ...DEFAULTS, ...stored };
    } catch (e) { /* sync may not exist, ignore */ }
  }

  function saveSettings() {
    if (!storage) return;
    try { storage.sync.set(settings); } catch (e) {}
  }

  // ---------- TTS (OS voices via SpeechSynthesis) ----------
  function refreshVoices() {
    try {
      voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    } catch (e) { voices = []; }
    return voices;
  }

  if (window.speechSynthesis) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  function siteKey() {
    try { return window.location.host || ''; } catch (e) { return ''; }
  }

  // A voice picked while playing on a site sticks to that site, so an
  // English game (Counterfeit Monkey) and an Italian one (Ghost Layer)
  // can each keep their own voice. Falls back to the global voiceURI.
  function effectiveVoiceURI() {
    const host = siteKey();
    if (host && settings.siteVoices && settings.siteVoices[host]) {
      return settings.siteVoices[host];
    }
    return settings.voiceURI;
  }

  function pickVoice() {
    refreshVoices();
    if (!voices.length) return null;
    const uri = effectiveVoiceURI();
    if (uri) {
      const v = voices.find(v => v.voiceURI === uri);
      if (v) return v;
    }
    // preferred set language, then it, then en, then default
    const pref = [settings.lang, 'it-IT', 'it', 'en-US', 'en'];
    for (const l of pref) {
      const v = voices.find(v => v.lang === l || v.lang?.startsWith(l.split('-')[0]));
      if (v) return v;
    }
    return voices.find(v => v.default) || voices[0];
  }

  function chunkText(text, max = settings.chunkSize) {
    // split into sentences for more natural reading
    const sentences = text.match(/[^.!?…\n]+[.!?…]+["»”']?\s*|[^.!?…\n]+$/g) || [text];
    const chunks = [];
    let buf = '';
    for (const s of sentences) {
      const t = s.trim();
      if (!t) continue;
      if ((buf + ' ' + t).trim().length <= max) {
        buf = (buf + ' ' + t).trim();
      } else {
        if (buf) chunks.push(buf);
        if (t.length <= max) {
          buf = t;
        } else {
          // sentence too long: split on words
          const words = t.split(/\s+/);
          let cur = '';
          for (const w of words) {
            if ((cur + ' ' + w).trim().length <= max) cur = (cur + ' ' + w).trim();
            else { if (cur) chunks.push(cur); cur = w; }
          }
          buf = cur;
        }
      }
    }
    if (buf) chunks.push(buf);
    return chunks.filter(Boolean);
  }

  function cleanText(raw) {
    if (!raw) return '';
    let t = raw.replace(/\s+/g, ' ').trim();
    // Parchment repeats ">" as a prompt: keep it non-invasive
    if (settings.skipEmptyPrompt && /^>+$/.test(t)) return '';
    return t;
  }

  function speakText(text, opts = {}) {
    if (!('speechSynthesis' in window)) {
      console.warn('[AdvToSpeech] speechSynthesis not supported');
      return;
    }
    const cleaned = cleanText(text);
    if (!cleaned) return;
    const chunks = chunkText(cleaned);
    for (const c of chunks) speakQueue.push({ text: c, ...opts });
    pumpQueue();
  }

  function pumpQueue() {
    if (isSpeakingSequence) return;
    if (!speakQueue.length) return;
    if (!settings.enabled) { speakQueue = []; return; }
    isSpeakingSequence = true;
    const item = speakQueue.shift();
    if (settings.ttsBackend === 'kokoro') {
      speakKokoroChunk(item.text).then(finishChunk).catch((e) => {
        if (String(e?.message || e) === 'kokoro-stopped') return finishChunk();
        // Experimental backend failed: read this chunk with the OS voice
        // instead of dropping it, then continue the queue.
        console.warn('[AdvToSpeech] Kokoro failed, falling back to OS voice:', e);
        speakOsChunk(item.text, finishChunk);
      });
    } else {
      speakOsChunk(item.text, finishChunk);
    }
    notifyState();
  }

  function finishChunk() {
    isSpeakingSequence = false;
    // short pause between chunks
    setTimeout(pumpQueue, 80);
    notifyState();
  }

  function speakOsChunk(text, done) {
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang || settings.lang || 'it-IT';
    u.rate = settings.rate;
    u.pitch = settings.pitch;
    u.volume = settings.volume;
    u.onend = u.onerror = done;
    try {
      window.speechSynthesis.speak(u);
    } catch (e) {
      done();
    }
  }

  // ---------- Kokoro backend (experimental opt-in) ----------
  // The engine runs in-process in the game tab (same code path on Chrome
  // and Firefox): synthesis + playback here, no offscreen document.
  // Page CSP may block the CDN import — then we fall back to OS voices.
  let kokoroEnginePromise = null;

  function getKokoroEngine() {
    if (!kokoroEnginePromise) {
      const ext = (typeof chrome !== 'undefined' ? chrome : browser);
      kokoroEnginePromise = import(ext.runtime.getURL('src/kokoro/engine.js'))
        .then((m) => m.createKokoroEngine())
        .catch((e) => { kokoroEnginePromise = null; throw e; });
    }
    return kokoroEnginePromise;
  }

  async function speakKokoroChunk(text) {
    let engine;
    try {
      engine = await getKokoroEngine();
    } catch (e) {
      throw new Error('kokoro-unavailable');
    }
    const outcome = await engine.speak({
      text,
      voice: settings.kokoroVoice || 'af_heart',
      speed: Math.min(2, Math.max(0.5, Number(settings.rate) || 1)),
      volume: settings.volume
    }).catch((e) => { throw new Error(String(e?.message || e)); });
    if (outcome === 'stopped') throw new Error('kokoro-stopped');
  }

  function stopKokoro() {
    // Never trigger a model download from a Stop action.
    if (kokoroEnginePromise) kokoroEnginePromise.then((e) => e.stop()).catch(() => {});
  }

  function stopSpeaking(clearQueue = true) {
    try { window.speechSynthesis?.cancel(); } catch (e) {}
    stopKokoro();
    if (clearQueue) speakQueue = [];
    isSpeakingSequence = false;
    notifyState();
  }

  // ---------- Parchment output detection ----------
  // Real structure (from web.css + GlkOte):
  // #windowport > .WindowFrame.BufferWindow > .BufferWindowInner > .BufferLine
  // last .BufferLine = current input line
  // .GridWindow = status bar, ignored by default
  function getBufferWindows() {
    let wins = Array.from(document.querySelectorAll('.BufferWindow'));
    if (!wins.length) {
      const port = document.getElementById('windowport');
      if (port) return [port];
      return [document.body];
    }
    if (settings.onlyMainWindow && wins.length > 1) {
      // the main window is the one with the most lines
      wins = wins.sort((a, b) =>
        a.querySelectorAll('.BufferLine').length - b.querySelectorAll('.BufferLine').length);
      return [wins[wins.length - 1]];
    }
    return wins;
  }

  function extractNewLines() {
    const wins = getBufferWindows();
    const fresh = [];
    for (const win of wins) {
      const lines = win.querySelectorAll('.BufferLine');
      // generic fallback: if there are no BufferLine nodes, watch new <p>/div children
      const nodes = lines.length ? Array.from(lines) : Array.from(win.children || []);
      for (const el of nodes) {
        if (spokenNodes.has(el)) continue;
        // the last line holds the live input: don't read it until it is "closed"
        // (when the user hits enter, Parchment turns it into a .Style_input line)
        const isLast = lines.length && el === nodes[nodes.length - 1];
        const hasInputField = el.querySelector?.('input, textarea, [contenteditable="true"], .LineInput');
        const inputText = el.querySelector?.('.LineInput')?.textContent ?? '';
        if (isLast && hasInputField && !el.querySelector('.Style_input')) {
          // input line still open: wait, don't mark it as read yet
          continue;
        }
        let text = (el.innerText ?? el.textContent ?? '').trim();
        // split command echo (Style_input) from the rest
        const echoEl = el.querySelector?.('.Style_input');
        if (echoEl && !settings.speakCommands) {
          // drop the echo, keep only the game response
          text = text.replace(echoEl.innerText ?? echoEl.textContent ?? '', '').trim();
        }
        if (!cleanText(text)) {
          spokenNodes.add(el);
          continue;
        }
        // avoid re-reading seen lines (e.g. scroll / re-render)
        spokenNodes.add(el);
        // label the command echo for clarity
        if (echoEl && settings.speakCommands) {
          const echo = cleanText(echoEl.innerText ?? echoEl.textContent ?? '');
          const rest = cleanText(text.replace(echo, ''));
          if (echo) fresh.push({ text: echo, isCommand: true });
          if (rest) fresh.push({ text: rest, isCommand: false });
        } else {
          fresh.push({ text, isCommand: false });
        }
      }
    }
    return fresh;
  }

  function onDomChanged() {
    if (!settings.enabled || !settings.autoRead) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const news = extractNewLines();
      if (!news.length) return;
      for (const n of news) {
        if (n.isCommand) speakText(`Command: ${n.text}`);
        else speakText(n.text);
      }
      updateFloatingBtn();
    }, settings.debounceMs);
  }

  function markAllAsRead() {
    // on first run: don't read all past history, start from here
    const wins = getBufferWindows();
    for (const win of wins) {
      for (const el of win.querySelectorAll('.BufferLine')) spokenNodes.add(el);
    }
    lastLineCount = document.querySelectorAll('.BufferLine').length;
  }

  function readLastResponse() {
    const lines = Array.from(document.querySelectorAll('.BufferWindow .BufferLine'));
    // take the last non-empty lines already seen and re-read them
    const texts = lines.slice(-4).map(el => cleanText(el.innerText ?? el.textContent ?? '')).filter(Boolean);
    if (!texts.length) return;
    stopSpeaking(true);
    speakText(texts.join(' '));
  }

  // ---------- Observer ----------
  let observer = null;
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(onDomChanged);
    const target = document.getElementById('windowport') || document.body;
    observer.observe(target, { childList: true, subtree: true, characterData: true });
  }

  // Parchment creates #windowport after load: wait for it
  function waitForGame() {
    if (document.getElementById('windowport')) {
      startObserver();
      // give the game time to load (Counterfeit Monkey ~5MB), then baseline + read intro
      setTimeout(() => {
        markAllAsRead();
        if (settings.autoRead && settings.enabled) {
          const lines = Array.from(document.querySelectorAll('.BufferWindow .BufferLine'))
            .map(el => cleanText(el.innerText ?? el.textContent ?? '')).filter(Boolean);
          if (lines.length) speakText(lines.join(' ').slice(0, 1500));
        }
      }, 2500);
      return;
    }
    setTimeout(waitForGame, 500);
  }

  // ---------- Floating UI in the page ----------
  function createFloatingBtn() {
    if (floatingBtn || !document.body) return;
    floatingBtn = document.createElement('button');
    floatingBtn.id = 'ats-floating';
    floatingBtn.title = 'Adventure To Speech: click = re-read last output, double-click = stop';
    floatingBtn.textContent = '🔊 ATS';
    Object.assign(floatingBtn.style, {
      position: 'fixed', bottom: '16px', right: '16px', zIndex: 999999,
      background: '#0b4c8e', color: '#fff', border: 'none', borderRadius: '24px',
      padding: '10px 16px', fontSize: '14px', cursor: 'pointer',
      boxShadow: '0 2px 10px rgba(0,0,0,.35)', opacity: '.92'
    });
    floatingBtn.addEventListener('click', () => readLastResponse());
    floatingBtn.addEventListener('dblclick', (e) => { e.stopPropagation(); stopSpeaking(true); });
    document.body.appendChild(floatingBtn);
    updateFloatingBtn();
  }

  function updateFloatingBtn() {
    if (!floatingBtn) return;
    floatingBtn.style.background = settings.enabled ? '#0b4c8e' : '#666';
    floatingBtn.textContent = !settings.enabled ? '🔇 ATS off'
      : (isSpeakingSequence || speakQueue.length) ? '🔊 ATS…' : '🔊 ATS';
  }

  function notifyState() {
    updateFloatingBtn();
    try {
      const msg = { type: 'ATS_STATE', enabled: settings.enabled, speaking: isSpeakingSequence, queued: speakQueue.length };
      (typeof chrome !== 'undefined' ? chrome.runtime : browser.runtime)?.sendMessage?.(msg).catch?.(() => {});
    } catch (e) {}
  }

  // ---------- Messages from the popup ----------
  function handleMessage(msg, sender, sendResponse) {
    if (!msg || !msg.type?.startsWith?.('ATS_')) return false;
    (async () => {
      switch (msg.type) {
        case 'ATS_GET_STATE':
          sendResponse({ ...settings, speaking: isSpeakingSequence, queued: speakQueue.length, voices: voices.map(v => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang })), host: siteKey(), siteVoiceURI: effectiveVoiceURI() });
          break;
        case 'ATS_TOGGLE':
          settings.enabled = !settings.enabled;
          if (!settings.enabled) stopSpeaking(true);
          else { markAllAsRead(); }
          saveSettings(); updateFloatingBtn();
          sendResponse({ enabled: settings.enabled });
          break;
        case 'ATS_SET':
          Object.assign(settings, msg.patch || {});
          // Switching engine/voice mid-speech must not mix backends.
          if (msg.patch && (msg.patch.ttsBackend !== undefined || msg.patch.kokoroVoice !== undefined)) {
            stopSpeaking(true);
          }          // A voiceURI picked from the popup on a game page is remembered
          // for that site (msg.site === true). Global changes from the
          // options page carry no flag and never stamp open game tabs.
          if (msg.site === true && msg.patch && msg.patch.voiceURI !== undefined) {
            const host = siteKey();
            if (host) {
              settings.siteVoices = settings.siteVoices || {};
              if (msg.patch.voiceURI) settings.siteVoices[host] = msg.patch.voiceURI;
              else delete settings.siteVoices[host];
            }
          }
          saveSettings();
          sendResponse({ ok: true });
          break;
        case 'ATS_STOP':
          stopSpeaking(true);
          sendResponse({ ok: true });
          break;
        case 'ATS_READ_LAST':
          readLastResponse();
          sendResponse({ ok: true });
          break;
        case 'ATS_READ_ALL_VISIBLE':
          stopSpeaking(true);
          speakText(Array.from(document.querySelectorAll('.BufferWindow .BufferLine'))
            .map(el => cleanText(el.innerText ?? el.textContent ?? '')).filter(Boolean).join(' ').slice(0, 3000));
          sendResponse({ ok: true });
          break;
      }
    })();
    return true; // async response
  }

  (typeof chrome !== 'undefined' ? chrome.runtime?.onMessage : browser.runtime?.onMessage)?.addListener(handleMessage);

  // unlock TTS on Chrome (needs a user gesture): first click/keypress enables voices
  function unlockAudio() {
    refreshVoices();
    try {
      // silent utterance to unlock
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis?.speak(u);
      window.speechSynthesis?.cancel();
    } catch (e) {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  }
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // ---------- boot ----------
  (async () => {
    await loadSettings();
    refreshVoices();
    waitForGame();
    createFloatingBtn();
    // if body is not there yet
    if (!floatingBtn) window.addEventListener('DOMContentLoaded', createFloatingBtn, { once: true });
  })();
})();
