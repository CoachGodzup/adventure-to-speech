# 04 — Cross-browser manifest (MV3, Chrome + Firefox)

Single `manifest.json`, Manifest V3. Targets: Chrome 88+, Firefox 109+
(`browser_specific_settings.gecko.strict_min_version`).

## Current manifest (essentials)

```json
{
  "manifest_version": 3,
  "permissions": ["storage"],
  "host_permissions": ["*://*.iplayif.com/*"],
  "background": { "service_worker": "src/background.js", "type": "module" },
  "action": { "default_popup": "src/popup.html" },
  "content_scripts": [{
    "matches": ["*://*.iplayif.com/*"],
    "js": ["src/content.js"],
    "run_at": "document_idle",
    "all_frames": false
  }],
  "options_page": "src/options.html",
  "browser_specific_settings": {
    "gecko": { "id": "adventure-to-speech@example.com", "strict_min_version": "109.0" }
  }
}
```

## Chrome / Firefox deltas to remember

- `background.service_worker` works in Chrome (MV3) and in Firefox 121+.
  For Firefox 109–120 the SW is ignored but the content script + popup still
  work; that is acceptable for v0.1. Do NOT add `background.scripts`
  (Chrome MV3 rejects it).
- `action` (MV3) is supported by both; Firefox still aliases `browser_action`.
- `storage.sync` exists in both; Firefox syncs via Firefox Sync, quota ~100KB —
  our settings are <2KB, fine.
- `web_accessible_resources: []` must be **removed** (empty array is invalid
  in MV3; omit the key unless you expose files).
- `minimum_chrome_version: "88"` is fine; there is no `minimum_firefox_version`
  key — the gecko `strict_min_version` covers it.
- Namespace: use `const api = globalThis.chrome ?? globalThis.browser` and
  promise-wrap callbacks so the same popup code runs in both browsers.
  Content script already does `chrome.runtime ?? browser.runtime`.

## Permissions rationale (for store review)

- `storage`: persist voice/rate/pitch toggles. No data leaves the device.
- `host_permissions: *://*.iplayif.com/*`: observe the game DOM and inject
  the floating button. No remote code, no analytics.
- No `<all_urls>`, no `tts`, no `activeTab`, no `scripting` needed for v0.1.
  A generic "read any adventure site" mode is roadmap (optional host toggle).

## Packaging

```bash
# Chrome: zip the project root (manifest.json at top level)
zip -r adventure-to-speech-chrome.zip manifest.json src icons README.md

# Firefox: same zip, upload to addons.mozilla.org (it accepts MV3).
# For local test: about:debugging → This Firefox → Load Temporary Add-on → manifest.json
# For Chrome test: chrome://extensions → Developer mode → Load unpacked → folder
```

The `release-packer` agent owns version bumps (`manifest.json` + git tag
`vX.Y.Z`) and these two zips. See `docs/06-roadmap.md`.
