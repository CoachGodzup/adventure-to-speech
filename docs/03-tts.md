# 03 — OS TTS via Web Speech API

The requirement "use the operating system TTS APIs" is satisfied by the
Web Speech API `speechSynthesis`: Chrome and Firefox route it to the OS
voices (macOS AVSpeech, Windows SAPI/OneCore, Linux Speech Dispatcher /
espeak / Festival, Android/iOS native TTS). No server, no API key, works offline
once voices are installed.

## Core flow (`src/content.js`)

```
new text → cleanText() → chunkText(≤220ch, sentence boundaries)
  → queue → pumpQueue() → SpeechSynthesisUtterance → speechSynthesis.speak()
  → onend/onerror → next chunk after 80ms
```

## Voices

- `speechSynthesis.getVoices()` is **async**: call `refreshVoices()` on boot
  and on `onvoiceschanged`.
- `pickVoice()`: explicit `settings.voiceURI` wins; otherwise prefer
  `settings.lang` → `it-IT` → `it` → `en-US` → `en` → `default` → first.
- Popup must list `ATS_GET_STATE.voices[]` as `{voiceURI, name, lang}` and
  store the chosen `voiceURI`. Never store the Voice object itself.
- Default `lang: 'it-IT'` because Counterfeit Monkey testers here are Italian,
  but the game text is English: users should pick an English voice. A future
  improvement is auto-detect `lang` per utterance.

## Chunking

- Long Glulx paragraphs can be 1000+ chars; single utterances get cut or
  pause badly. `chunkText()` splits on `/[^.!?…\n]+[.!?…]+["»”']?\s*|…/` and
  packs sentences up to `chunkSize` (default 220), splitting oversized
  sentences on words.
- Tune `chunkSize` in options (120–300). Smaller = more responsive stop,
  larger = more prosody.

## Autoplay policy

- Chrome requires a **user gesture** before `speak()`. The content script
  unlocks on first `click`/`keydown` with a silent zero-volume utterance.
- Consequence: the intro is queued but stays silent until the user clicks
  the page. Document this in popup ("click the page once to enable audio").
- `speechSynthesis.cancel()` on `ATS_STOP` / toggle-off clears the hardware queue too.

## Chrome vs Firefox differences

| Topic | Chrome | Firefox |
|---|---|---|
| Voice list | many Google + OS voices, `default` flag reliable | OS voices only, list may arrive late → re-query on `onvoiceschanged` |
| `pause()/resume()` | reliable | historically flaky → we only use `speak/cancel`, no pause |
| Rate/pitch | wide range, `rate` 0.5–2 safe | narrower, clamp `rate` 0.5–2, `pitch` 0–2 |
| `onerror interrupted` | fires on `cancel()` | same; our handler treats error as end-of-chunk (correct) |
| Headless test | needs `--enable-speech` flag | needs `media.webspeech.synth.enabled` |

## Do NOT

- Do not use `chrome.tts` (background-only, different voice set, extra
  `tts` permission, harder to keep in sync with the page queue).
- Do not use remote TTS APIs (latency, keys, privacy, offline breakage).
- Do not call `speak()` without chunking + queueing: overlapping utterances
  are the #1 bug in naive implementations.
