**Slicing strategy:** risk-first, then vertical. Slice 1 proves the riskiest part (SVG → PNG rasterization + gesture-safe image clipboard) in isolation; slice 2 wires the buttons end to end in the lib; slice 3 wires the app labels; slice 4 docs and final verification.

**Pre-existing working-tree changes:** `libs/share/src/components/SharePopover/SharePopover.tsx`, `SharePopover.module.scss`, `tests/SharePopover.spec.tsx` and `AccessControl/AccessControl.tsx` already have uncommitted edits on this branch. Build on top of them; do not revert or reformat them.

All relative TS imports stay extensionless (`./QrActions`, `../../utils/qr-image`); only `.scss` keeps its extension.

## 1. Rasterization helper (risk-first)

- [x] 1.1 Create `libs/share/src/utils/qr-image.ts` exporting `createQrPngBlob(svg: SVGSVGElement, options?: { size?: number; margin?: number }): Promise<Blob>` per design D2: clone the SVG, rewrite `currentColor` fills to `#000000`, drop the background, set `xmlns`/`width`/`height`, serialise with `XMLSerializer`, load via a `data:image/svg+xml;charset=utf-8,` URL into an `Image`, draw on a white canvas (default 512 px, 32 px margin), `toBlob('image/png')`, reject on a `null` blob or image load error. Module-level helpers are `const` arrow functions; multi-line comments use `/* */`.
- [x] 1.2 Add `libs/share/src/utils/tests/qr-image.spec.ts` stubbing `HTMLCanvasElement.prototype.getContext`/`toBlob` and `Image` load/error: resolves with an `image/png` blob; fills white before drawing; serialised markup contains `#000000` and no `currentColor`; draws the code inset by the margin; rejects when `toBlob` yields `null`; rejects when the image fails to load.

  **Verification:** `npm run test:file -- libs/share/src/utils/tests/qr-image.spec.ts`

## 2. QR actions in the lib (vertical slice)

- [x] 2.1 Add optional `svgRef?: Ref<SVGSVGElement>` to `QrCodeProps` in `libs/share/src/components/QrCode/QrCode.tsx` and forward it to `react-qr-code`'s `ref` (JSDoc on the prop). No other rendering change.
- [x] 2.2 Add the four optional label fields `qrCopyButtonLabel`, `qrCopiedButtonLabel`, `qrDownloadButtonLabel`, `qrDownloadFileName` (with JSDoc stating the English defaults) to `SharePopoverLabels` in `libs/share/src/models/share-popover-props.ts`.
- [x] 2.3 Create internal `libs/share/src/components/QrActions/QrActions.tsx` (not exported from `src/index.ts`) per design D3–D6: props `url`, `getSvg`, `copyLabel`, `copiedLabel`, `downloadLabel`, `downloadFileName`; centred `flex items-center justify-center gap-4 self-center` row of two kit `GhostButton`s (`label` + `iconBefore` with `IconCopy`/`IconCheck` and `IconDownload`, `DIAL_ICON_SIZE.SM`, `stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`); synchronous `navigator.clipboard.write([new ClipboardItem({ 'image/png': createQrPngBlob(svg) })])` with fallback to `copyToClipboard(url)` from `@epam/ai-dial-chat-shared`; copied state reset after `DEFAULT_RESET_DELAY_MS` (check whether `chat-shared` exports it; otherwise use the same 2000 ms-style constant locally with a comment pointing at `useCodeCopy`), timer cleared on unmount; `sr-only` `role="status" aria-live="polite"` region; download via `createQrPngBlob` + `triggerBlobDownload(blob, downloadFileName)`, failures caught silently.
- [x] 2.4 In `libs/share/src/components/SharePopover/SharePopover.tsx`: destructure the new labels with defaults (`'Copy'`, `'Copied'`, `'Download'`, `'share-qr-code.png'`), create a `useRef<SVGSVGElement>(null)`, pass it as `svgRef` to `QrCode`, and render `<QrActions … />` right after `QrCode` in the QR branch only (before the expiry note).
- [x] 2.5 Add `libs/share/src/components/QrActions/tests/QrActions.spec.tsx` (mock `../../utils/qr-image` and the `chat-shared` clipboard/download helpers; query by role/name/text only, no `data-testid`): copies image via `clipboard.write` when `ClipboardItem` exists; falls back to URL text when `ClipboardItem` is undefined; falls back when `clipboard.write` rejects; shows "Copied" + status announcement and keeps focus on the button; resets after the delay (fake timers); stays in default state when every path fails; download calls `triggerBlobDownload` with a PNG blob and the default/custom filename; download failure does not call `triggerBlobDownload` and raises nothing.
- [x] 2.6 Extend `libs/share/src/components/SharePopover/tests/SharePopover.spec.tsx`: Copy/Download buttons appear only in the QR view (absent in link view, loading and error); custom QR labels render; Tab reaches Copy and Download inside the trap; Escape from Download returns to the link view without calling `onClose`.
- [x] 2.7 Extend the `QrCode` tests (create `libs/share/src/components/QrCode/tests/QrCode.spec.tsx` if none exists): `svgRef.current` is the rendered `SVGSVGElement`; without `svgRef` no buttons are rendered.
- [x] 2.8 RTL check: confirm the action row uses only `gap`/`justify-center` (no physical `ml`/`mr`/`left`/`right`), icons are leading via `iconBefore`, and copy/check/download icons carry no `rtl:scale-x-[-1]` (non-directional).
- [x] 2.9 Architecture guard for `libs/share`: grep the changed files to confirm no `/api` paths, no `@epam/ai-dial-chat-api-client` / `server-api` imports, no app contexts, i18n, env, routing, analytics, storage, or feature flags; filename default is a plain label, not derived from host data. `package.json` dependencies unchanged.

  **Verification:** `npm run test:file -- libs/share/src/components/QrActions/tests/QrActions.spec.tsx`, `npm run test:file -- libs/share/src/components/SharePopover/tests/SharePopover.spec.tsx`, `npm run test:file -- libs/share/src/components/QrCode/tests/QrCode.spec.tsx`; then `npm run verify:changed` once for the slice.

## 3. App wiring and i18n

- [x] 3.1 Add `"qrDownloadFileName": "share-qr-code.png"` to the `share` block in `apps/chat/src/i18n/locales/en.json` and `QrDownloadFileName = 'share.qrDownloadFileName'` to `ShareI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 3.2 Pass `qrCopyButtonLabel: t(ButtonsI18nKeys.Copy)`, `qrCopiedButtonLabel: t(ShareI18nKeys.CopiedButtonLabel)`, `qrDownloadButtonLabel: t(ButtonsI18nKeys.Download)`, `qrDownloadFileName: t(ShareI18nKeys.QrDownloadFileName)` in `apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx` and `apps/chat/src/components/ShareConversationPopoverContainer/ShareConversationPopoverContainer.tsx`.
- [x] 3.3 Update `apps/chat/src/components/SharePopoverContainer/tests/SharePopoverContainer.spec.tsx` and `apps/chat/src/components/ShareConversationPopoverContainer/tests/ShareConversationPopoverContainer.spec.tsx` to assert the new labels are forwarded (in the same style those specs already assert existing labels).

  **Verification:** `npm run test:file -- apps/chat/src/components/SharePopoverContainer/tests/SharePopoverContainer.spec.tsx`, `npm run test:file -- apps/chat/src/components/ShareConversationPopoverContainer/tests/ShareConversationPopoverContainer.spec.tsx`; then `npm run verify:changed`.

## 4. Docs and final verification

- [x] 4.1 Update `libs/share/README.md`: document the new `SharePopoverLabels` fields and defaults, the QR view's Copy/Download behaviour (image clipboard with URL-text fallback, PNG download, host CSP must allow `data:` in `img-src` for the image path), and `QrCode`'s new optional `svgRef` prop in its example/props list. Every example must compile against the current API.
- [x] 4.2 Run `npm run validate:docs` and fix any reported drift.
- [x] 4.3 Run `npm run verify:full` once to close the change (add `npm run build:quiet` only if the `libs/share` build output changes unexpectedly).
