/* Adventure To Speech - options page (same keys as popup + advanced settings). */

const DEFAULTS = {
  enabled: true,
  autoRead: true,
  voiceURI: '',
  lang: 'it-IT',
  siteVoices: {},  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  speakCommands: true,
  onlyMainWindow: true,
  chunkSize: 220,
  debounceMs: 600,
  skipEmptyPrompt: true,
  ttsBackend: 'os',
  kokoroVoice: 'af_heart',
  siteVoices: {}
};

// Curated Kokoro English voices (voiceURI-style ids). All Kokoro v1 voices
// are English (a* = American, b* = British); use the custom field below to
// experiment with other ids. See docs/08-kokoro.md.
const KOKORO_VOICES = [
  ['af_heart', 'Heart (US female, recommended)'],
  ['af_bella', 'Bella (US female)'],
  ['af_nicole', 'Nicole (US female)'],
  ['af_sarah', 'Sarah (US female)'],
  ['am_adam', 'Adam (US male)'],
  ['am_michael', 'Michael (US male)'],
  ['bf_emma', 'Emma (UK female)'],
  ['bf_isabella', 'Isabella (UK female)'],
  ['bm_george', 'George (UK male)'],
  ['bm_lewis', 'Lewis (UK male)']
];

const api = globalThis.chrome ?? globalThis.browser;

function promisify(fn, ...args) {
  try {
    const r = fn(...args);
    if (r && typeof r.then === 'function') return r;
  } catch (e) {}
  return new Promise((resolve, reject) => {
    fn(...args, (res) => {
      const err = api?.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve(res);
    });
  });
}

const $ = (id) => document.getElementById(id);

async function load() {
  try {
    return { ...DEFAULTS, ...await promisify(api.storage.sync.get.bind(api.storage.sync), DEFAULTS) };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

async function save(patch) {
  try {
    await promisify(api.storage.sync.set.bind(api.storage.sync), patch);
  } catch (e) {}
  // Push live to any open game tabs (best effort).
  try {
    const tabs = await promisify(api.tabs.query.bind(api.tabs), { url: ['*://*.iplayif.com/*', '*://xaltotun84.github.io/*'] });
    for (const t of tabs || []) {
      if (t?.id == null) continue;
      try { await promisify(api.tabs.sendMessage.bind(api.tabs), t.id, { type: 'ATS_SET', patch }); } catch (_) {}
    }
  } catch (e) {}
  $('status').textContent = 'Saved.';
}

function bindCheckbox(id, key, state) {
  const el = $(id);
  el.checked = !!state[key];
  el.addEventListener('change', () => save({ [key]: el.checked }));
}

function bindSlider(id, outId, key, state) {
  const el = $(id);
  const out = $(outId);
  el.value = String(state[key]);
  out.textContent = String(state[key]);
  el.addEventListener('input', () => { out.textContent = el.value; });
  el.addEventListener('change', () => save({ [key]: Number(el.value) }));
}

function bindNumber(id, key, state, min, max) {
  const el = $(id);
  el.value = String(state[key]);
  el.addEventListener('change', () => {
    const n = Math.min(max, Math.max(min, Number(el.value) || state[key]));
    el.value = String(n);
    save({ [key]: n });
  });
}

async function boot() {
  const state = await load();

  for (const [id, key] of [['enabled', 'enabled'], ['autoRead', 'autoRead'], ['speakCommands', 'speakCommands'], ['onlyMainWindow', 'onlyMainWindow'], ['skipEmptyPrompt', 'skipEmptyPrompt']]) {
    bindCheckbox(id, key, state);
  }
  for (const [id, out, key] of [['rate', 'rateVal', 'rate'], ['pitch', 'pitchVal', 'pitch'], ['volume', 'volumeVal', 'volume']]) {
    bindSlider(id, out, key, state);
  }
  bindNumber('chunkSize', 'chunkSize', state, 120, 300);
  bindNumber('debounceMs', 'debounceMs', state, 100, 2000);

  const lang = $('lang');
  if (![...lang.options].some((o) => o.value === state.lang)) {
    const opt = document.createElement('option');
    opt.value = state.lang;
    opt.textContent = state.lang;
    lang.appendChild(opt);
  }
  lang.value = state.lang;
  lang.addEventListener('change', () => save({ lang: lang.value }));

  const voice = $('voice');
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'Auto (match language)';
  voice.appendChild(auto);
  // Voices live in the page context; options can only offer Auto + stored value.
  if (state.voiceURI) {
    const opt = document.createElement('option');
    opt.value = state.voiceURI;
    opt.textContent = state.voiceURI;
    voice.appendChild(opt);
    voice.value = state.voiceURI;
  }
  voice.addEventListener('change', () => save({ voiceURI: voice.value }));

  renderSiteVoices(state.siteVoices || {});
  initKokoro(state);
}

function renderSiteVoices(map) {
  const box = $('siteVoices');
  box.textContent = '';
  const hosts = Object.keys(map);
  if (!hosts.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'None yet — open a game site and pick a voice from the popup.';
    box.appendChild(p);
    return;
  }
  for (const host of hosts.sort()) {
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('span');
    label.textContent = `${host} → ${map[host]}`;
    label.style.overflowWrap = 'anywhere';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Forget';
    btn.addEventListener('click', async () => {
      const next = { ...(await load()).siteVoices };
      delete next[host];
      await save({ siteVoices: next });
      renderSiteVoices(next);
    });
    row.appendChild(label);
    row.appendChild(btn);
    box.appendChild(row);
  }
}

// ---------- Kokoro backend (experimental opt-in) ----------
// The engine runs in-process in this page (extension origin, separate model
// cache from the game tabs). Same code path on Chrome and Firefox.
let kokoroEnginePromise = null;

function kokoroProgressUpdate(p) {
  if (!p) return;
  if (typeof p.progress === 'number') $('kokoroProgress').value = Math.round(p.progress * 100);
  else if (typeof p.loaded === 'number' && typeof p.total === 'number' && p.total > 0) {
    $('kokoroProgress').value = Math.round((p.loaded / p.total) * 100);
  }
  kokoroNote(`Downloading: ${p.file || p.status || 'model files'}…`);
}

function getOptionsKokoroEngine() {
  if (!kokoroEnginePromise) {
    kokoroEnginePromise = import('./kokoro/engine.js')
      .then((m) => m.createKokoroEngine({ onProgress: kokoroProgressUpdate }))
      .catch((e) => { kokoroEnginePromise = null; throw e; });
  }
  return kokoroEnginePromise;
}

function kokoroNote(text) {
  $('kokoroStatus').textContent = text;
}

function initKokoro(state) {
  const backend = $('ttsBackend');
  backend.value = state.ttsBackend === 'kokoro' ? 'kokoro' : 'os';
  backend.addEventListener('change', () => {
    save({ ttsBackend: backend.value });
    refreshKokoroStatus();
  });

  const voice = $('kokoroVoice');
  for (const [id, label] of KOKORO_VOICES) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${label} [${id}]`;
    voice.appendChild(opt);
  }
  if (!KOKORO_VOICES.some(([id]) => id === state.kokoroVoice)) {
    const opt = document.createElement('option');
    opt.value = state.kokoroVoice;
    opt.textContent = `${state.kokoroVoice} (custom)`;
    voice.appendChild(opt);
  }
  voice.value = state.kokoroVoice;
  voice.addEventListener('change', () => {
    $('kokoroVoiceCustom').value = '';
    save({ kokoroVoice: voice.value });
  });

  const custom = $('kokoroVoiceCustom');
  custom.value = KOKORO_VOICES.some(([id]) => id === state.kokoroVoice) ? '' : state.kokoroVoice;
  custom.addEventListener('change', () => {
    const id = custom.value.trim();
    if (id) save({ kokoroVoice: id });
  });

  $('kokoroPreload').addEventListener('click', async () => {
    $('kokoroProgress').value = 0;
    kokoroNote('Starting download… (first run fetches ~85MB, then works offline)');
    try {
      const engine = await getOptionsKokoroEngine();
      await engine.preload();
      $('kokoroProgress').value = 100;
      kokoroNote('Model ready — cached for offline use. Select the Kokoro engine above to use it.');
    } catch (e) {
      kokoroNote(`Download failed: ${e?.message || e}. OS voices still work.`);
    }
  });

  refreshKokoroStatus();
}

async function refreshKokoroStatus() {
  if (!kokoroEnginePromise) {
    kokoroNote('Model not downloaded yet — use the button above (~85MB, once).');
    return;
  }
  try {
    const res = await kokoroEnginePromise.then((e) => e.status());
    if (res && res.loaded) kokoroNote('Model ready — cached for offline use.');
    else if (res && res.loading) kokoroNote('Model is loading…');
    else kokoroNote('Model not downloaded yet — use the button above (~85MB, once).');
  } catch (e) {
    kokoroNote('Kokoro status unavailable. OS voices still work.');
  }
}

document.addEventListener('DOMContentLoaded', () => boot().catch((e) => { $('status').textContent = String(e?.message || e); }));
