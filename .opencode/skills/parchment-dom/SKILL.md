---
name: parchment-dom
description: Detect new Parchment/iplayif game output via BufferWindow/BufferLine selectors, split Style_input echo, ignore GridWindow
license: MIT
compatibility: opencode
metadata:
  audience: extension-builder, parchment-scout
  workflow: dom-detection
---

## What I do

Provide the canonical DOM contract for Parchment (iplayif.com GlkOte) so agents detect **only new** game output.

## Selectors

- Root: `#windowport` (poll — created after JS boot). Fallback: `document.body`.
- Main windows: `.BufferWindow` (pick the one with most `.BufferLine` when several).
- Output lines: `.BufferWindow .BufferLine` — each new node = candidate output.
- Live input: `.BufferLine:last-child` holding `input, textarea, [contenteditable], .LineInput` — skip until it gains `.Style_input` (Enter pressed).
- Command echo: `.Style_input` inside the line — prefix `Command: <echo>` or strip it per `speakCommands`.
- Ignore: `.GridWindow` (status bar), pure `>` prompts (`skipEmptyPrompt`).
- Text: `el.innerText ?? el.textContent`, collapsed whitespace.

## Detection recipe

1. `MutationObserver(#windowport, {childList, subtree, characterData})` + debounce ~600ms.
2. Track seen nodes in a `WeakSet` (never index counting — Parchment re-renders on scroll).
3. On fire: collect unseen `.BufferLine`, skip open input line, split echo, drop empties, queue the rest in DOM order.
4. Baseline: `markAllAsRead()` ~2.5s after `#windowport` appears (Counterfeit Monkey .gblorb ~5MB loads slowly), then optionally speak intro once.

## When to use me

Load me before touching `getBufferWindows()`, `extractNewLines()`, `markAllAsRead()`, or any game-page selector. Full spec: `docs/02-parchment-dom.md`.
