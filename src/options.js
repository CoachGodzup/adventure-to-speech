/* Adventure To Speech - options page (same keys as popup + advanced settings). */

const DEFAULTS = {
  enabled: true,
  autoRead: true,
  voiceURI: '',
  lang: 'it-IT',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  speakCommands: true,
  onlyMainWindow: true,
  chunkSize: 220,
  debounceMs: 600,
  skipEmptyPrompt: true
};

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
    const tabs = await promisify(api.tabs.query.bind(api.tabs), { url: '*://*.iplayif.com/*' });
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
}

document.addEventListener('DOMContentLoaded', () => boot().catch((e) => { $('status').textContent = String(e?.message || e); }));
