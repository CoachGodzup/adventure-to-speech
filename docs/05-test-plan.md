# 05 — Test plan (Counterfeit Monkey on iplayif.com)

Official URL:

```
https://iplayif.com/?story=https%3A%2F%2Fgithub.com%2Fi7%2Fcounterfeit-monkey%2Freleases%2Fdownload%2Fr11.1%2FCounterfeitMonkey-11.gblorb
```

## Manual smoke test (~5 min)

1. Load unpacked extension (Chrome `chrome://extensions` / Firefox
   `about:debugging → Load Temporary Add-on`).
2. Open the URL, **click once** on the page (unlocks Chrome TTS).
3. EXPECT: intro paragraph is read aloud once; floating button `🔊 ATS` bottom-right.
4. Type `look` + Enter.
   EXPECT: hears `Command: look` (if `speakCommands` on) then the room description, once, no repeats.
5. Type `x me` + Enter. EXPECT: only the new response is read.
6. Click floating button → re-reads last output. Double-click → stops.
7. Popup: toggle off → speech stops immediately, button shows `🔇 ATS off`.
   Toggle on → no backlog is replayed.
8. Popup: change voice/rate → next output uses the new voice/rate.

## Edge cases

| # | Case | Expected |
|---|---|---|
| E1 | Reload mid-game | intro re-read once, no duplication of pre-reload text |
| E2 | Fast typing (3 commands in <1s) | all 3 responses queued in order, none skipped |
| E3 | Empty command (Enter on `>`) | nothing spoken (`skipEmptyPrompt`) |
| E4 | Status bar changes (score/moves) | never spoken (`onlyMainWindow`) |
| E5 | Very long room text (>1000ch) | split into ~220ch chunks, stop works mid-way |
| E6 | No OS voices installed | no crash, console warning only |
| E7 | Firefox first run | voices appear after `onvoiceschanged`, popup list updates |

## Suggested starter commands (Counterfeit Monkey)

- `look`, `x me`, `inventory`, `help`, `about`
- These produce short, deterministic outputs — good for TTS assertions.

## Automated checks (for `tts-qa` agent)

- `node --check src/content.js src/background.js src/popup.js src/options.js`
- `python3 -c "import json; json.load(open('manifest.json'))"` (valid JSON)
- Optional Playwright: load page, count `speechSynthesis.speak` calls via
  stubbed `SpeechSynthesisUtterance` — assert 1 speak per command, 0 on status-bar mutation.
- No secrets in repo: `grep -ri "api[_-]\?key" --include="*.js" --include="*.json" .` must be empty.
