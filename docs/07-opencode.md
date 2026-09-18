# 07 — OpenCode agents & skills (how this project uses them)

This project is developed with OpenCode. Project-local definitions live in:

```
.opencode/agents/*.md          # subagents, invoked with @name
.opencode/skills/<name>/SKILL.md  # reusable behavior, loaded via skill tool
```

Global equivalents (`~/.config/opencode/…`) are NOT used, so the repo stays self-contained.

## Agents (4)

| File | Name | Mode | Job |
|---|---|---|---|
| `.opencode/agents/extension-builder.md` | `extension-builder` | subagent | implements `background.js`, popup, options, icons, manifest fixes; owns vanilla-JS + MV3 correctness |
| `.opencode/agents/parchment-scout.md` | `parchment-scout` | subagent | analyzes iplayif/Parchment DOM changes, evolves `content.js` detection; read-only except `src/content.js` + `docs/02-*` |
| `.opencode/agents/tts-qa.md` | `tts-qa` | subagent | validates speech queue/chunking/voices, runs §05 checks, files repro steps; never edits source, only reports + test scripts |
| `.opencode/agents/release-packer.md` | `release-packer` | subagent | bumps version, builds Chrome/Firefox zips, writes changelog; allowed `bash: zip/unzip`, `read`, `edit` on manifest/README |

Invoke: `@extension-builder implement the popup per docs/01-architecture.md`.
Primary agents (`build`/`plan`) may delegate automatically based on descriptions.

## Skills (3)

| Directory | Name | When to load |
|---|---|---|
| `.opencode/skills/parchment-dom/` | `parchment-dom` | before touching any game-page DOM logic (selectors, echo split, GridWindow exclusion) |
| `.opencode/skills/webextension-tts/` | `webextension-tts` | before touching any `speechSynthesis` code (queue, chunking, unlock, voices) |
| `.opencode/skills/crossbrowser-packaging/` | `crossbrowser-packaging` | before editing `manifest.json` or building zips |

Each `SKILL.md` has frontmatter `{name, description}` with `name == directory name`
(lowercase-alphanumeric-hyphen). Agents see them via the `skill` tool and load
on demand: `skill({ name: "parchment-dom" })`.

## Permissions model

- `parchment-scout`: `edit: deny` globally except `src/content.js` + `docs/02-parchment-dom.md` (ask).
- `tts-qa`: `edit: deny`, `bash: allow` only for `node --check`, `python3`, `grep`, `zip -T`.
- `release-packer`: `bash: allow` for packaging commands, `edit: allow` for `manifest.json`, `README.md`, `CHANGELOG.md`.
- All agents: `skill: allow` (they must load the relevant skill first).

## Adding a new agent/skill

1. Copy the closest existing file.
2. Keep `description` ≤1024 chars, specific enough for auto-delegation.
3. File name = agent name (`review.md` → `@review`).
4. Validate: open opencode, type `@` — the new agent appears; run `skill({name})` — the SKILL.md loads.
