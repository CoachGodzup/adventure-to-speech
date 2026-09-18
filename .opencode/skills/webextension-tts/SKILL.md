---
name: webextension-tts
description: Queue and chunk speechSynthesis utterances with OS voices, user-gesture unlock, and reliable stop for browser extensions
license: MIT
compatibility: opencode
metadata:
  audience: extension-builder, tts-qa
  workflow: tts-queue
---

## What I do

Define the correct way to speak game text from a content script using OS voices (`speechSynthesis` → AVSpeech/SAPI/Speech Dispatcher). No `chrome.tts`, no cloud APIs.

## Rules

1. **Queue, never overlap**: `speakQueue[]` + `pumpQueue()` — one `SpeechSynthesisUtterance` at a time, next on `onend/onerror` (+80ms pause). Treat `onerror(interrupted)` as end-of-chunk (fires on `cancel()`).
2. **Chunk**: split on sentence boundaries, pack to `chunkSize` default 220 (range 120–300). Split oversized sentences on words. Long Glulx paragraphs exceed single-utterance limits.
3. **Voices**: `getVoices()` is async — refresh on boot + `onvoiceschanged`. `pickVoice()`: stored `voiceURI` → `settings.lang` → `it-IT`/`it` → `en-US`/`en` → `default` → first. Popup lists `{voiceURI, name, lang}`, stores only `voiceURI`.
4. **Unlock**: Chrome needs a gesture — on first `click`/`keydown`, speak a zero-volume utterance then `cancel()`. Tell users to "click the page once to enable audio".
5. **Stop**: `speechSynthesis.cancel()` + clear queue + reset flag. No `pause()/resume()` (flaky in Firefox).
6. **Prosody**: clamp `rate` 0.5–2, `pitch` 0–2, `volume` 0–1; set `utterance.lang` from the chosen voice.

## When to use me

Load me before touching `speakText()`, `chunkText()`, `pickVoice()`, `pumpQueue()`, popup voice/rate UI, or debugging double-speech/dropped speech. Full spec: `docs/03-tts.md`.
