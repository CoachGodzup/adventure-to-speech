# TODO — adventure-to-speech

> Source of truth for planning: `docs/06-roadmap.md`. This file is the actionable checklist.

## v0.1.0 — MVP (must-have)

- [x] MV3 `manifest.json` (single file, Chrome + Firefox)
- [x] `src/content.js` (observer + TTS queue + floating button + `ATS_*` protocol)
- [x] `docs/` (00–07)
- [x] `.opencode/agents/` (extension-builder, parchment-scout, tts-qa, release-packer)
- [x] `.opencode/skills/` (parchment-dom, webextension-tts, crossbrowser-packaging)
- [x] `src/background.js` — minimal module service worker (`onInstalled` defaults, `ATS_STATE` forwarding)
- [x] `src/popup.html` / `popup.js` / `popup.css` — enabled toggle, voice select, rate/pitch/volume sliders, autoRead + speakCommands checkboxes, Read-last + Stop buttons (400px max, `chrome.*`/`browser.*` fallback)
- [x] `src/options.html` / `options.js` — same as popup plus `onlyMainWindow`, `chunkSize`, `debounceMs`, `lang`
- [x] `icons/` — PNG 16/32/48/128 (replace `.gitkeep`; source: one SVG, megaphone + speech bubble)
- [x] `manifest.json` cleanup — remove empty `web_accessible_resources: []`
- [x] `README.md` — install steps (Chrome + Firefox), test URL, usage, permissions rationale
- [x] `LICENSE` — BSD 3-Clause
- [x] `CONTRIBUTING.md` — dev setup, agents/skills workflow, checks
- [x] `CHANGELOG.md` — Keep-a-Changelog format, `0.1.0` entry
- [ ] Manual smoke test passes (`docs/05-test-plan.md`, edge cases E1–E7)

## v0.2.0 — UX

- [ ] Per-utterance language detection (game text EN vs UI locale)
- [ ] Click-to-read any paragraph
- [ ] Keyboard shortcut `Alt+R` (commands API) — read last / toggle
- [ ] Skip-list for repeated room names
- [ ] Optional `chrome.tts` backend toggle (Chromebook users)

## v0.3.0 — Coverage

- [ ] Generic adventure-site mode (user-added host patterns in options)
- [ ] Per-site DOM adapters (`parchment`, `generic-article`) selected by URL
- [ ] i18n (`_locales/en`, `_locales/it`; remove hardcoded `Command:` prefix)

## Non-goals

- No cloud TTS, no accounts, no analytics (see `docs/06-roadmap.md`).
