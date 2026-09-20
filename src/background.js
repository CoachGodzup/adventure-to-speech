/* Adventure To Speech - background service worker (MV3 module).
 * Sets install defaults and optionally reflects speaking state on the badge.
 * All speech happens in src/content.js via speechSynthesis (OS voices).
 */

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
  skipEmptyPrompt: true,
  ttsBackend: 'os',
  kokoroVoice: 'af_heart',
  siteVoices: {}
};

const api = globalThis.chrome ?? globalThis.browser;

if (api?.runtime?.onInstalled) {
  api.runtime.onInstalled.addListener(async (details) => {
    if (details.reason !== 'install' && details.reason !== 'update') return;
    try {
      const stored = await api.storage.sync.get(DEFAULTS);
      await api.storage.sync.set({ ...DEFAULTS, ...stored });
    } catch (e) {
      // storage.sync may be unavailable (e.g. Firefox without Sync): ignore.
    }
  });
}

if (api?.runtime?.onMessage) {
  api.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'ATS_STATE') return false;
    // Optional badge: show a dot while speaking, clear when idle.
    try {
      const text = msg.speaking || msg.queued > 0 ? '...' : '';
      api.action?.setBadgeText?.({ text });
      api.action?.setBadgeBackgroundColor?.({ color: '#0b4c8e' });
    } catch (e) {}
    return false;
  });
}
