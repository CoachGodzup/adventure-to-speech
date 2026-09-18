# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-18

### Added

- MV3 `manifest.json` shared by Chrome and Firefox (storage + iplayif host permissions).
- `src/content.js`: Parchment observer, TTS queue with chunking, floating re-read/stop button, `ATS_*` message protocol.
- `src/background.js`: install defaults, speaking-state badge.
- `src/popup.html/js/css`: enabled toggle, voice select, rate/pitch/volume sliders, auto-read and speak-commands flags, read-last and stop buttons.
- `src/options.html/js`: full settings incl. language, chunk size, debounce, status-bar filtering.
- `icons/`: PNG 16/32/48/128 generated from a single speech-bubble design.
- `README.md`: install and build-from-source instructions, test URL, permissions rationale.
