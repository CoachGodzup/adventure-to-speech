# Contributing to adventure-to-speech

Thanks for helping! This project is developed with [OpenCode](https://opencode.ai), and the repo
is organized so both humans and OpenCode agents can work on it effectively.

## Start here

1. Read [`README.md`](README.md) and [`TODO.md`](TODO.md).
2. Read the specs you need in [`docs/`](docs/):
   - `00-overview.md` — goal and test URL
   - `01-architecture.md` — message protocol (`ATS_*`) and settings keys (normative)
   - `02-parchment-dom.md` — game-page selectors and detection rules
   - `03-tts.md` — speech queue / chunking / voices rules
   - `04-manifest-crossbrowser.md` — MV3 + packaging rules
   - `05-test-plan.md` — smoke test and edge cases E1–E7
3. Check [`TODO.md`](TODO.md) and pick an unchecked item.

## Working with OpenCode agents

Project-local agents live in `.opencode/agents/` (invoke with `@name`):

| Agent | Use for |
|---|---|
| `@extension-builder` | popup, options, background, icons, manifest |
| `@parchment-scout` | game-page DOM detection (`src/content.js`) |
| `@tts-qa` | validating speech behavior (reports only, never edits) |
| `@release-packer` | version bumps, changelogs, release zips |

Reusable skills in `.opencode/skills/` are loaded via `skill({ name })`:
`parchment-dom`, `webextension-tts`, `crossbrowser-packaging`.
Load the relevant skill **before** touching matching code (each agent file reminds you).

## Ground rules

- **English everywhere** — code, comments, docs, commit messages.
- **Vanilla JS only**, no npm dependencies for the extension itself.
- **Minimal permissions** — never add `<all_urls>`, `tts`, or `scripting` without discussion.
- **Never break the `ATS_*` protocol** in `src/content.js` without updating `docs/01-architecture.md`
  and the popup/options code together.
- **No cloud TTS, no accounts, no analytics** (see `docs/06-roadmap.md` non-goals).
- **No secrets in the repo** — `grep -ri "api[_-]\?key" --include="*.js" --include="*.json" .` must be empty.

## Checks before opening a PR

```bash
node --check src/*.js
python3 -c "import json; json.load(open('manifest.json'))"
```

Plus the manual smoke test in `docs/05-test-plan.md` (Counterfeit Monkey URL + `look` / `x me`).

## Releases

`@release-packer` owns versioning: bump `manifest.json`, update `CHANGELOG.md`,
build and verify the zips. Never commit secrets; never force-push to `main`.
