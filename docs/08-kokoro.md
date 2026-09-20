# 08 — Kokoro local neural backend (experimental prototype, opt-in)

## Why

OS voices reading English game text with an Italian system voice sound bad, and
even native English OS voices are dated concatenative synthesis. Kokoro-82M
(Apache-2.0, 82M params) runs 100% locally in the browser via ONNX Runtime
WebAssembly and sounds much more natural. It keeps the project promises: no
server, no API keys, offline after the first download, nothing leaves the device.

## Architecture: engine in the game tab (single code path, Chrome + Firefox)

No offscreen document (Firefox has none): the engine runs in-process where it
is needed, via the shared module `src/kokoro/engine.js` (no `chrome.*`
dependency — load / speak / stop / status + WebAudio playback).

```
game tab: src/content.js (queue + chunking, unchanged)
    │  lazy import('src/kokoro/engine.js') on first Kokoro chunk
    ▼  (synthesis + playback in the tab; reply per chunk keeps queue order)
options page: imports ./kokoro/engine.js directly (preload button + status)
```

- The queue, chunking, debounce and Parchment detection stay in `content.js`.
  Each chunk calls `engine.speak()`; it resolves `'ended'` on natural playback
  end, `'stopped'` if superseded by Stop/toggle.
- Any Kokoro failure falls back to the OS voice for that chunk (content.js
  `pumpQueue` catch path) — the game is never left silent. A Stop action never
  triggers a model download.
- Engine choice is the global `ttsBackend` setting (`os` default); Kokoro voice
  is the global `kokoroVoice` id (default `af_heart`). No `ATS_KOKORO_*`
  runtime messages exist: everything is in-process.

## Settings added

- `ttsBackend: 'os' | 'kokoro'`, `kokoroVoice` (default `'af_heart'`).
- Popup voice picks carry `site: true` so the per-site OS-voice memory only
  records popup choices, never options-page broadcasts.

## Hard limits of this prototype

1. **Page CSP risk.** The content-script engine imports the library and weights
   from CDN/HuggingFace, which the game page's CSP may block (iplayif.com
   untested; github.io sends no CSP). Any block falls back to OS voices with a
   console warning. Vendoring the dependencies into the package removes both
   the CSP risk and the remote-code store violation (see 4).
2. **English-only voices.** All Kokoro v1 voice ids are English (`af_*`/`am_*`
   American, `bf_*`/`bm_*` British). Italian games (Ghost Layer) still need OS
   voices — per-site engine selection is a follow-up (see below).
3. **First run needs internet**: ~85MB q8 weights + runtime files, then cached
   offline. The model is cached per site (game tab and options page each keep
   their own copy). Use Options → Download button and watch progress before
   playing.
4. **Not store-compliant**: loading the library from a CDN is remote code
   (MV3 forbids it for store review). Before any store release, vendor
   kokoro-js, onnxruntime-web and the model cache into the package.
5. **Autoplay policy**: WebAudio may start suspended until user interaction;
   clicking the game page once (already required for OS voices) normally
   covers it.
6. **Not browser-tested yet**: syntax/JSON validated only (`node --check`);
   needs the manual smoke test below on real hardware (Chrome AND Firefox).

## Manual smoke test (Chrome AND Firefox, unpacked)

1. Load unpacked, open Options → Voice engine → select Kokoro engine.
2. Click Download, wait for "Model ready — cached for offline use."
3. Open the Counterfeit Monkey URL, click the page once, type `look`.
   EXPECT: neural English voice, one chunk after another, no overlap.
4. Popup Stop / toggle off mid-speech. EXPECT: audio stops immediately.
5. Switch engine back to OS. EXPECT: next output uses the OS voice.
6. Repeat 3–4 on Ghost Layer (Italian game, no CSP on github.io).
   EXPECT: engine loads from CDN; Italian text read with an English Kokoro
   voice (documents the per-site-engine follow-up, not a bug in this prototype).
7. DevTools console on iplayif.com during 3: EXPECT no CSP errors; if the CDN
   import is blocked, OS-voice fallback + warning is the accepted outcome.

## Follow-ups (not in prototype)

- Vendor dependencies + model for a store-compliant build.
- Per-site engine memory (Kokoro for English games, OS voice for Italian ones).
- WebGPU + fp16 path, streaming synthesis for lower time-to-first-audio.
- Italian Kokoro voices if/when upstream ships them.
