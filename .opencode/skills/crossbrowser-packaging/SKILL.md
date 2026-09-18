---
name: crossbrowser-packaging
description: Keep a single MV3 manifest valid for Chrome and Firefox and build clean distribution zips
license: MIT
compatibility: opencode
metadata:
  audience: extension-builder, release-packer
  workflow: packaging
---

## What I do

Keep `manifest.json` shippable in both stores with one file and produce reproducible zips.

## Manifest rules (MV3)

- `manifest_version: 3`, `permissions: ["storage"]`, `host_permissions: ["*://*.iplayif.com/*"]` only.
- `background: { service_worker: "src/background.js", type: "module" }` — valid in Chrome and Firefox 121+. Never add `background.scripts` (Chrome rejects it).
- `action.default_popup: "src/popup.html"` (both browsers accept `action`).
- `options_page: "src/options.html"`.
- `browser_specific_settings.gecko: { id, strict_min_version: "109.0" }` — Chrome ignores it.
- Omit `web_accessible_resources` when empty (empty array is invalid MV3).
- JS must use `globalThis.chrome ?? globalThis.browser` with callback→promise wrapping.

## Packaging

```bash
zip -r adventure-to-speech-chrome-<ver>.zip manifest.json src icons README.md CHANGELOG.md
zip -T adventure-to-speech-chrome-<ver>.zip && unzip -l adventure-to-speech-chrome-<ver>.zip
```

- `manifest.json` at zip top level; no `node_modules`.
- Firefox accepts the same artifact via addons.mozilla.org; local test via `about:debugging → Load Temporary Add-on`.
- Chrome local test via `chrome://extensions → Developer mode → Load unpacked`.
- Version source of truth: `manifest.json` `version` (semver).

## When to use me

Load me before editing `manifest.json`, adding permissions/hosts, or cutting a release. Full spec: `docs/04-manifest-crossbrowser.md`.
