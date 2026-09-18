# adventure-to-speech — Overview

**Project name:** `adventure-to-speech`
**Type:** MV3 browser extension for **Chrome + Firefox**
**Goal:** read text adventures aloud, command after command,
using the **operating system TTS** (via the Web Speech API `speechSynthesis`).

## Official test URL

```
https://iplayif.com/?story=https%3A%2F%2Fgithub.com%2Fi7%2Fcounterfeit-monkey%2Freleases%2Fdownload%2Fr11.1%2FCounterfeitMonkey-11.gblorb
```

- Game: **Counterfeit Monkey** by Emily Short (`.gblorb` file, Glulx format, ~5.4 MB gz / ~11 MB unpacked).
- Web player: **Parchment** (IF interpreter, `iplayif.com`, sources: `curiousdannii/parchment`).
- The game takes a few seconds to load: the content script must wait for `#windowport`.

## Required behavior

1. The plugin "listens" to the page (MutationObserver).
2. After each user command, it reads **only the new game output**.
3. It must never re-read everything on every mutation.
4. No external server: fully local, OS voices.
5. Minimal UI: popup on/off + voice/rate/pitch, floating button in the page,
   re-read last output, stop.

## Current repo state

- `manifest.json` — MV3, host `*://*.iplayif.com/*`, background SW, content script, popup, options (the latter files still need to be completed, see `docs/01-architecture.md`).
- `src/content.js` — already implemented: observer, TTS queue, chunking, WeakSet of already-read nodes, `.Style_input` handling, floating button, `ATS_*` messaging.
- Missing: `src/popup.html/.js/.css`, `src/options.html/.js`, `src/background.js`, `icons/*`, `README.md`, packaging scripts.

## Conventions

- UI + docs language: **English**.
- Single MV3 manifest (Chrome 88+, Firefox 109+ with `browser_specific_settings.gecko`).
- No npm dependencies for the extension itself (vanilla JS).
- See the other files in `docs/` for DOM, TTS, cross-browser manifest, test plan and roadmap.
