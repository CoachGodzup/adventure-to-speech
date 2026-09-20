# 01 — Extension architecture

```
adventure-to-speech/
├── manifest.json            # single MV3 Chrome+Firefox (DONE)
├── src/
│   ├── content.js           # observer + TTS + floating button (DONE)
│   ├── background.js        # TODO: minimal SW (install, messages, manual injection)
│   ├── popup.html/js/css    # TODO: on/off, voice, rate/pitch/volume, read-last, stop
│   └── options.html/js      # TODO: same settings plus speakCommands, onlyMainWindow
├── icons/                   # TODO: icon16/32/48/128.png (from SVG)
├── docs/                    # THIS FOLDER
├── .opencode/agents/        # dev agents (see docs/07-opencode.md)
├── .opencode/skills/        # reusable skills (see docs/07-opencode.md)
└── README.md                # TODO
```

## Runtime messages (already defined in `content.js`)

The content script listens on `chrome.runtime.onMessage`:

| type | payload | effect |
|---|---|---|
| `ATS_GET_STATE` | — | replies `{...settings, speaking, queued, voices[]}` |
| `ATS_TOGGLE` | — | flips `enabled`, stops or calls `markAllAsRead()` |
| `ATS_SET` | `{patch}` | merges settings + `storage.sync.set` |
| `ATS_STOP` | — | `speechSynthesis.cancel()` + clears queue |
| `ATS_READ_LAST` | — | re-reads the last 4 `.BufferLine` nodes |
| `ATS_READ_ALL_VISIBLE` | — | reads all visible text (max 3000 chars) |
| `ATS_SET` (+`site: true`) | `{patch}` | from the popup on a game tab: merges settings and remembers `patch.voiceURI` for that host in `siteVoices`. Options-page broadcasts carry no flag and never stamp open tabs |

Kokoro runs in-process (content script on game tabs, options page for
preload) via `src/kokoro/engine.js` — no `ATS_KOKORO_*` runtime messages exist.
See `docs/08-kokoro.md`.

Supported game hosts: `*://*.iplayif.com/*` (Parchment, e.g. Counterfeit Monkey
in English) and `*://xaltotun84.github.io/*` (direct Quixe, e.g. Ghost Layer in
Italian — same GlkOte DOM: `#windowport`, `.BufferWindow`, `.BufferLine`).

Popup/options must use these messages; they must never touch the page DOM directly.

## Settings (DEFAULTS in content.js)

```js
{
  enabled: true, autoRead: true,
  voiceURI: '', lang: 'it-IT',
  rate: 1.0, pitch: 1.0, volume: 1.0,
  speakCommands: true, onlyMainWindow: true,
  chunkSize: 220, debounceMs: 600, skipEmptyPrompt: true,
  siteVoices: {},              // host -> voiceURI (popup picks stick to the site)
  ttsBackend: 'os',            // 'os' or 'kokoro' (experimental, see docs/08-kokoro.md)
  kokoroVoice: 'af_heart'      // Kokoro voice id (English-only in v1)
}
```

Persistence: `chrome.storage.sync` (fallback: no-op when missing).
Popup/options implementers must read/write the **same keys**.

## What remains (for `extension-builder`)

1. `src/background.js` — module service worker:
   - `onInstalled` → set defaults in `storage.sync`.
   - `onMessage` forward of `ATS_STATE` (optional badge).
   - `action.onClicked` if ever without popup (not needed now).
2. `src/popup.html/js` — max 400px, vanilla:
   - enabled toggle, voice select (from `ATS_GET_STATE.voices`), rate slider 0.5–2, pitch 0–2, volume 0–1, autoRead/speakCommands checkboxes, Read-last + Stop buttons.
   - `chrome.*` + `browser.*` namespace fallback.
3. `src/options.html/js` — same plus `onlyMainWindow`, `chunkSize`, `debounceMs`, `lang`.
4. `icons/` — draw 1 SVG (megaphone + adventure speech bubble) and export PNG 16/32/48/128 (better than raw SVG for Chrome).
5. Check `manifest.json`: `web_accessible_resources: []` must be removed or correctly populated for MV3 (omit it when empty).

## Constraints

- No external `fetch` from the content script (iplayif CSP).
- No extra `tts` / `activeTab` permissions: `storage` + `host_permissions` are enough.
- All speech goes through `speechSynthesis` in the content script (page context = OS voices available).
