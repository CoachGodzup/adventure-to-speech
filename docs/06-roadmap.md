# 06 — Roadmap

## v0.1.0 (current milestone — MVP)

- [x] `manifest.json` MV3 single-file Chrome+Firefox
- [x] `src/content.js`: observer, TTS queue, chunking, floating button, `ATS_*` protocol
- [ ] `src/background.js` (minimal SW)
- [ ] `src/popup.html/js/css`
- [ ] `src/options.html/js`
- [ ] `icons/` PNG 16/32/48/128
- [ ] `README.md` with install + test URL
- [ ] Manual smoke test passes (§05 E1–E7)

## v0.2.0 — UX

- Per-utterance language detect (game text EN vs UI locale): set `utterance.lang` dynamically.
- Click-to-read any paragraph; keyboard shortcut `Alt+R` (commands API).
- Skip list / profanity filter for repeated room names.
- Optional `chrome.tts` backend toggle for Chromebook users.

## v0.3.0 — Coverage

- Generic adventure-site mode: user adds host patterns in options
  (`*://*.textadventures.co.uk/*`, `*://*.ifiction.org/*`, …).
- Per-site DOM adapters (`parchment`, `generic-article`) selected by URL.
- i18n: `_locales/en`, `_locales/it` (remove hardcoded `Command:` prefix).

## Non-goals

- No cloud TTS, no accounts, no analytics.
- No mobile apps (mobile browsers cannot load unpacked MV3 the same way).
- No screen-reader replacement claims: this is a game companion, not AT.
