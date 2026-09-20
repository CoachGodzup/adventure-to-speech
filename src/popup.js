/* Adventure To Speech - popup (max 400px, vanilla, Chrome + Firefox). */

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

async function getActiveTab() {
  const tabs = await promisify(api.tabs.query.bind(api.tabs), { active: true, currentWindow: true });
  return tabs && tabs[0];
}

async function sendToTab(type, patch, site) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab');
  const msg = patch ? { type, patch } : { type };
  if (site === true) msg.site = true;
  return promisify(api.tabs.sendMessage.bind(api.tabs), tab.id, msg);
}

const $ = (id) => document.getElementById(id);

function setStatus(text) {
  $('status').textContent = text;
}

function fillVoices(select, voices, currentURI) {
  select.textContent = '';
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'Auto (match language)';
  select.appendChild(auto);
  for (const v of voices || []) {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.voiceURI === currentURI) opt.selected = true;
    select.appendChild(opt);
  }
  if (!currentURI) auto.selected = true;
}

function bindSlider(id, outId, key, state) {
  const input = $(id);
  const out = $(outId);
  input.value = String(state[key]);
  out.textContent = String(state[key]);
  input.addEventListener('input', async () => {
    out.textContent = input.value;
    try {
      await sendToTab('ATS_SET', { [key]: Number(input.value) });
    } catch (e) {
      setStatus('Settings saved for next page load (game tab not reachable).');
      try { await promisify(api.storage.sync.set.bind(api.storage.sync), { [key]: Number(input.value) }); } catch (_) {}
    }
  });
}

async function setPatch(patch) {
  try {
    await sendToTab('ATS_SET', patch);
  } catch (e) {
    // Tab may not have the content script (e.g. not on iplayif.com):
    // persist anyway so the next game page picks it up.
    try { await promisify(api.storage.sync.set.bind(api.storage.sync), patch); } catch (_) {}
    throw e;
  }
}

async function boot() {
  let state = null;
  try {
    state = await sendToTab('ATS_GET_STATE');
  } catch (e) {
    // Not on a game tab: fall back to stored settings.
    try {
      state = await promisify(api.storage.sync.get.bind(api.storage.sync), null);
    } catch (_) {}
    setStatus('Open a game on iplayif.com to control live speech; settings below apply on next load.');
  }

  const s = {
    enabled: true, autoRead: true, speakCommands: true,
    voiceURI: '', rate: 1.0, pitch: 1.0, volume: 1.0, ttsBackend: 'os',
    ...(state || {})
  };

  $('enabled').checked = !!s.enabled;
  $('autoRead').checked = !!s.autoRead;
  $('speakCommands').checked = !!s.speakCommands;
  // The voice picked on a game tab sticks to that site (English voice for
  // Counterfeit Monkey, Italian voice for Ghost Layer, ...).
  const host = state?.host || '';
  fillVoices($('voice'), state?.voices || [], state?.siteVoiceURI || s.voiceURI);
  if (host) {
    $('siteHint').textContent = state?.siteVoices?.[host]
      ? `This site (${host}) uses its remembered voice. Pick another one to change it.`
      : `The voice you pick here will be remembered for this site (${host}).`;
  }
  bindSlider('rate', 'rateVal', 'rate', s);
  bindSlider('pitch', 'pitchVal', 'pitch', s);
  bindSlider('volume', 'volumeVal', 'volume', s);

  if (state && state.speaking !== undefined) {
    setStatus(state.speaking ? 'Speaking…' : state.queued > 0 ? `Queued: ${state.queued}` : 'Idle.');
  }
  $('backendHint').textContent = s.ttsBackend === 'kokoro'
    ? 'Engine: Kokoro local neural voice (experimental). Change it in Settings.'
    : '';

  $('enabled').addEventListener('change', async (e) => {
    try {
      const res = await sendToTab('ATS_TOGGLE');
      e.target.checked = !!res?.enabled;
    } catch (_) {
      await setPatch({ enabled: e.target.checked });
    }
  });

  $('autoRead').addEventListener('change', (e) => setPatch({ autoRead: e.target.checked }).catch(() => {}));
  $('speakCommands').addEventListener('change', (e) => setPatch({ speakCommands: e.target.checked }).catch(() => {}));
  $('voice').addEventListener('change', async (e) => {
    try {
      await sendToTab('ATS_SET', { voiceURI: e.target.value }, true);
      if (host) $('siteHint').textContent = `This site (${host}) uses its remembered voice. Pick another one to change it.`;
    } catch (_) {
      await setPatch({ voiceURI: e.target.value });
    }
  });

  $('readLast').addEventListener('click', async () => {
    try { await sendToTab('ATS_READ_LAST'); }
    catch { setStatus('Open a game on iplayif.com first.'); }
  });
  $('stop').addEventListener('click', async () => {
    try { await sendToTab('ATS_STOP'); }
    catch { setStatus('Nothing to stop (no game tab).'); }
  });
}

document.addEventListener('DOMContentLoaded', () => boot().catch((e) => setStatus(String(e?.message || e))));
