# Adventure To Speech

A browser extension (Chrome + Firefox, Manifest V3) that reads **text adventures aloud**,
command after command, using your **operating system's TTS voices** — no server, no API keys,
fully offline once voices are installed.

> Made with [OpenCode](https://opencode.ai) and **Muse Spark 1.3** (Meta's Muse Spark model,
> via the OpenCode contributor integration) — the plugin scaffold, docs, agents and skills in
> this repo were authored with that setup.

## How it works

1. You play a text adventure in the browser (e.g. on [iplayif.com](https://iplayif.com), powered by Parchment).
2. The extension **listens to the page** (`MutationObserver` on `#windowport`) and detects each **new**
   game output after every command you type.
3. It speaks only the new text via the Web Speech API (`speechSynthesis`), which routes to the OS
   voices (macOS AVSpeech, Windows SAPI/OneCore, Linux Speech Dispatcher, Android/iOS native TTS).
4. A floating button in the page lets you re-read the last output (click) or stop speech (double-click).

## Test it

Official test game — **Counterfeit Monkey** by Emily Short:

```
https://iplayif.com/?story=https%3A%2F%2Fgithub.com%2Fi7%2Fcounterfeit-monkey%2Freleases%2Fdownload%2Fr11.1%2FCounterfeitMonkey-11.gblorb
```

1. Load the extension (see below), open the URL, **click once on the page** (Chrome needs a user gesture to unlock audio).
2. The intro is read aloud. Type `look` + Enter → you hear `Command: look` plus the room description.
3. Try `x me`, `inventory`, `help`.

## Install

### Chrome

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this folder.
2. Or install the release zip (`adventure-to-speech-chrome-<ver>.zip`) via the same flow (unzip first).

### Firefox

1. `about:debugging` → **This Firefox** → **Load Temporary Add-on** → pick `manifest.json`.
2. Or upload the release zip to `addons.mozilla.org` for a signed build.

## Permissions (why each one)

| Permission | Why |
|---|---|
| `storage` | Persist voice / rate / pitch / toggles. Nothing leaves your device. |
| `*://*.iplayif.com/*` | Observe the game DOM and inject the floating button. No remote code, no analytics. |

## Project structure

```
manifest.json            # single MV3 manifest (Chrome + Firefox)
src/content.js           # page observer + TTS queue + floating button
src/background.js        # service worker (install defaults, state forwarding)
src/popup.*              # toolbar popup UI
src/options.*            # full settings page
docs/                    # specs: architecture, Parchment DOM, TTS, test plan, roadmap
.opencode/agents/        # dev subagents (@extension-builder, @parchment-scout, @tts-qa, @release-packer)
.opencode/skills/        # reusable behavior (parchment-dom, webextension-tts, crossbrowser-packaging)
TODO.md                  # actionable checklist
```

See [`TODO.md`](TODO.md) for what's done and what's next, and [`CONTRIBUTING.md`](CONTRIBUTING.md)
if you want to help.

## License

BSD 3-Clause — see [`LICENSE`](LICENSE).
