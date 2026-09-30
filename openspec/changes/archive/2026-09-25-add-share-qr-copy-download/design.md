## Context

`SharePopover` (`libs/share/src/components/SharePopover/SharePopover.tsx`) swaps between a link view (`LinkView`, URL pill + icon copy button) and a QR view (`QrCode`, an SVG from `react-qr-code` inside a themed frame). The QR view is display-only. The design adds a centred row of two accent text+icon buttons — **Copy** and **Download** — between the QR frame and the expiry note.

Constraints:

- `libs/share` is a publishable, host-agnostic lib (AGENTS.md §Library isolation, `.claude/rules/libs.md`). It already peers on `@epam/ai-dial-chat-shared` (clipboard + download helpers) and `@epam/ai-dial-ui-kit`, and depends on `@tabler/icons-react` and `react-qr-code`.
- All strings come in through `SharePopoverLabels` with English defaults; the chat app passes `t()` values from `SharePopoverContainer` and `ShareConversationPopoverContainer`.
- The popover owns a Tab trap and a two-step Escape (QR → Link → close). New controls must live inside that trap without extra wiring (`getInteractiveElements` in `libs/share/src/utils/focus.ts` already picks up buttons).
- The on-screen QR fill follows `--qr-color` → `--text-primary`, which is light in dark themes. An exported image must not inherit that.

## Goals / Non-Goals

**Goals:**

- Copy the QR as a PNG image to the clipboard, with a text fallback.
- Download the QR as a PNG file.
- Feedback and a11y on par with the existing link copy (check icon, "Copied" label, `aria-live`).
- No new dependencies, no host integration knowledge in the lib.

**Non-Goals:**

- Actions on standalone `QrCode`; SVG export; Web Share API; configurable resolution; theming the exported image.

## Decisions

### D1. New internal `QrActions` component, rendered by `SharePopover`

`SharePopover` renders `<QrCode …/>` followed by `<QrActions …/>` in the QR branch. `QrActions` is internal (not exported from `src/index.ts`), mirroring how `LinkView` and `AccessControl` are internal.

`QrActions` props: `url`, `getSvg: () => SVGSVGElement | null`, `copyLabel`, `copiedLabel`, `downloadLabel`, `downloadFileName`.

To reach the SVG, `QrCode` gains an optional `svgRef?: Ref<SVGSVGElement>` forwarded to `react-qr-code` (it forwards `ref` to the `<svg>`). This is an additive, optional prop on the exported `QrCode` — documented in the README.

*Alternative:* re-generate the QR matrix independently for export (e.g. via `qr.js`, already a transitive dep of `react-qr-code`). Rejected: two encoders could diverge (error-correction level, version), and serialising the SVG we already render guarantees the exported image is what the user sees.

*Alternative:* put the buttons inside `QrCode`. Rejected — see proposal (keeps `QrCode` a pure renderer).

### D2. SVG → PNG rasterization in `libs/share/src/utils/qr-image.ts`

`createQrPngBlob(svg: SVGSVGElement, options?: { size?: number; margin?: number }): Promise<Blob>`

1. Clone the SVG; set every `path` fill that uses `currentColor` to `#000000` and the background to transparent; set explicit `width`/`height` and `xmlns`.
2. Serialise with `XMLSerializer`, load into an `Image` via a `data:image/svg+xml;charset=utf-8,` URL (no object URL → nothing to revoke, no CSP `blob:` img-src concern).
3. Draw on a canvas of `size` (default 512 px) filled `#ffffff`, the code inset by `margin` (default 32 px — the QR quiet zone).
4. `canvas.toBlob(resolve, 'image/png')`; reject if the blob is `null`.

Fixed black-on-white is deliberate: scanners need high contrast and a light quiet zone, and the file lands in someone else's context (same reasoning as the inline-style literals in `libs/chat-shared/src/utils/copy-to-clipboard.ts`).

The helper stays in `libs/share` (only consumer). Promote to `chat-shared` later only if a second lib needs it.

### D3. Copy: image first, URL text fallback, gesture-safe

Safari rejects `navigator.clipboard.write` if any `await` precedes it in the click handler. So `copy` calls `clipboard.write` **synchronously** with a `ClipboardItem` whose value is the *promise* of the blob:

```ts
navigator.clipboard.write([
  new ClipboardItem({ 'image/png': createQrPngBlob(svg) }),
]);
```

Chromium and Firefox (≥127) accept a `Promise<Blob>` value too. Resolution:

| Condition | Behaviour |
| --- | --- |
| `ClipboardItem` + `clipboard.write` available, write resolves | Image copied → "Copied" state |
| APIs missing, SVG not available, or write rejects | `copyToClipboard(url)` from `@epam/ai-dial-chat-shared`; on `true` → "Copied" state |
| Fallback also fails | No state change (same as `useCodeCopy` today) |

The "Copied" state reuses `useCodeCopy`'s timing (`DEFAULT_RESET_DELAY_MS`) via a local `useTimedFlag`-style state in `QrActions` — `useCodeCopy` itself only copies text, so it cannot be reused directly. Timer cleared on unmount.

*Alternative:* extend `useCodeCopy` with an async producer. Rejected: widens a shared public hook for one consumer.

### D4. Download: PNG via `triggerBlobDownload`

`await createQrPngBlob(svg)` then `triggerBlobDownload(blob, downloadFileName)` from `@epam/ai-dial-chat-shared` (`libs/chat-shared/src/utils/file-download.ts:114`), which already handles detached-anchor quirks and object-URL revocation. Downloads are not gesture-gated the way clipboard writes are, so awaiting is fine. On rasterization failure: nothing is downloaded, no crash; the error is swallowed silently in the lib (the lib has no notification channel — host notification would need a new callback, out of scope; see Open Questions).

Filename default `share-qr-code.png`, overridable through `labels.qrDownloadFileName`. It sits in `labels` because it is user-visible text a host may localise. The lib does not derive a name from the entity — that would require host knowledge.

### D5. Layout, styling, RTL

- Row: `flex items-center justify-center gap-4 self-center`, directly after `QrCode`, before the expiry note (the popover's existing `gap-3` spacing applies).
- Buttons: kit `GhostButton` with `label` + `iconBefore` (`IconCopy`/`IconCheck`, `IconDownload`), `DIAL_ICON_SIZE.SM`, `stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden` on icons — identical to `SharePopoverHeader`. No SCSS changes, no new colour tokens.
- RTL: the row is centred and uses `gap`, icons are leading via `iconBefore` (the kit places them logically). Copy/download icons are not directional — no mirroring.
- Mobile: the popover is a fixed `w-96` surface rendered inside the host's popup; two short buttons fit at any width ≥ 320 px. No breakpoint branching.

### D6. Accessibility

- Both are native buttons with visible text labels — accessible names come from the text; no extra `aria-label`.
- Copy feedback: label switches to `copiedLabel`, icon to a check; a visually hidden `role="status" aria-live="polite"` region announces `copiedLabel` (same pattern as `LinkView`).
- Focus: both buttons join the popover's Tab trap automatically. Focus stays on the Copy button through the state change (the element is not remounted — only its label/icon props change).
- Escape behaviour unchanged.

### D7. Labels and i18n

New optional `SharePopoverLabels` fields:

| Field | Default | App key |
| --- | --- | --- |
| `qrCopyButtonLabel` | `"Copy"` | `buttons.copy` (existing) |
| `qrCopiedButtonLabel` | `"Copied"` | `share.copiedButtonLabel` (existing) |
| `qrDownloadButtonLabel` | `"Download"` | `buttons.download` (existing) |
| `qrDownloadFileName` | `"share-qr-code.png"` | `share.qrDownloadFileName` (new, value `share-qr-code.png`) |

Separate `qr*` fields rather than reusing `copyButtonLabel`/`copiedButtonLabel`: those are the link button's tooltip/aria strings and a host may want "Copy link" there vs "Copy" under the QR.

### States

- **Loading / error**: the QR view (and therefore `QrActions`) only renders when `url != null && error == null && !isLoading` — no new states.
- **Copy/download in flight**: rasterization is ~ms; no spinner. Buttons are not disabled while in flight; a double click copies twice, harmlessly.
- **Failure**: copy falls back to text; download fails silently (D4).

### Memoisation

`QrActions` handlers are plain inline functions; `SharePopover` is already `memo`-wrapped and the actions render only in the QR view. No `useCallback` needed — the children are kit buttons, not memoised consumers.

## Risks / Trade-offs

- [Firefox < 127 lacks `ClipboardItem`] → text fallback copies the URL; still shows "Copied". Acceptable degradation, documented in the spec.
- [Clipboard permission denied / insecure context] → write rejects → text fallback (which itself may use `execCommand`).
- [jsdom has no canvas/`Image` decoding] → unit-test `qr-image.ts` with stubbed `HTMLCanvasElement.prototype.getContext`/`toBlob` and `Image`; test `QrActions` with `createQrPngBlob` mocked.
- [Host CSP blocks `data:` images] → the chat app allows it (`apps/chat-api/src/config/csp.ts:158`, `imgSrc: ['self', 'data:', 'blob:', 'https:']`). A stricter third-party host would lose the image path: copy falls back to text, download fails silently. Noted in the README.
- [SVG `currentColor` inside a cloned node not resolving] → D2 rewrites fills to literal colours before serialising.

## Migration Plan

Additive. Ship lib + app wiring in one change. Rollback = revert the commit; no persisted state.

## Open Questions

- Should download/copy failures surface a host notification (new optional `onQrActionError` callback)? Proposed: not now; revisit if QA reports silent failures.
- Should the default filename include the entity name (e.g. `gpt-4o-qr.png`)? That's host knowledge — possible later via the existing `qrDownloadFileName` label, no lib change needed.
