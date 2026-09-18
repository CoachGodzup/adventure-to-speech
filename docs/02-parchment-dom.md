# 02 — Parchment DOM (iplayif.com)

Source of truth: `https://iplayif.com/dist/web/web.css` + GlkOte conventions
(upstream `curiousdannii/parchment`, `curiousdannii/asyncglk`).

## Tree

```html
<body>
  <div id="gameport">
    <div id="windowport"></div>   <!-- created after JS boot -->
    <div id="loadingpane">…cover + "Loading…"…</div>
    <div id="errorpane" style="display:none">…</div>
  </div>
</body>
```

After boot, `#windowport` contains Glk windows:

```html
<div id="windowport">
  <div id="window0" class="WindowFrame BufferWindow" style="…">
    <div class="BufferWindowInner">
      <div class="BufferLine">…story text <span class="Style_header">…</span>…</div>
      <div class="BufferLine">…<span class="Style_input">look</span>…</div>
      <div class="BufferLine">…last line, holds the live input…
        <span class="LineInput">…</span>
      </div>
    </div>
  </div>
  <div id="window1" class="WindowFrame GridWindow">…status bar…</div>
</div>
```

## Key selectors (used by `src/content.js`)

| Selector | Meaning |
|---|---|
| `#windowport` | observer root; may not exist on `document_idle`, poll for it |
| `.BufferWindow` | main story window(s); `getBufferWindows()` collects them |
| `.BufferWindow .BufferLine` | one paragraph/output line each; new output = new nodes |
| `.BufferLine:last-child` | live input line (flex, wraps `.LineInput`); skip until closed |
| `.Style_input` | echoed user command, bold; present once Enter is pressed |
| `.GridWindow` | status bar (location/score/turns); ignored when `onlyMainWindow: true` |
| `textarea.Input`, `.BufferWindow .Input`, `.LineInput` | hidden/visible input fields managed by GlkOte |
| `.Style_emphasized`, `.Style_header`, `.Style_subheader`, `.Style_alert`, `.Style_note`, `.Style_blockquote_par`, `.Style_preformatted` | inline styles; `innerText` already flattens them |

## Detection rules implemented

1. Observe `#windowport` (fallback `document.body`) with
   `{ childList: true, subtree: true, characterData: true }`.
2. Debounce `600ms` (`settings.debounceMs`): Glk emits output in batches.
3. `extractNewLines()`:
   - iterate `.BufferLine` nodes in the main window (most lines wins when several `.BufferWindow` exist);
   - skip nodes already in `spokenNodes` (WeakSet);
   - skip the last line while it still holds an open input field and has no `.Style_input`;
   - split `.Style_input` echo from the rest; prefix echo with `Command:` when `speakCommands` is on, strip it otherwise;
   - drop empty / pure `>` prompts when `skipEmptyPrompt` is on.
4. Initial baseline: `markAllAsRead()` 2.5s after `#windowport` appears (Counterfeit Monkey `.gblorb` is ~5MB, loading takes seconds), then optionally speak the intro (first 1500 chars).
5. Generic fallback: if no `.BufferLine` exists (another engine/site), treat direct children of `#windowport`/`body` as lines.

## Gotchas for future agents

- Parchment re-renders on scroll/resize: never rely on index counting, always use the WeakSet.
- `innerText` vs `textContent`: prefer `innerText` (respects layout) with `textContent` fallback (Firefox hidden frames).
- The echo line contains both command and response in one `.BufferLine`: it must be split, otherwise the command is read twice.
- GridWindow updates every turn (score/moves): reading it would spam speech — keep ignoring it by default.
- Test reference: Counterfeit Monkey starts with a long intro + first prompt `>`. The first `>` must be skipped, the intro must be read once.
