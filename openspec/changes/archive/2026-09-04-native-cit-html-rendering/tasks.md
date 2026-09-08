## 1. Shared markdown pipeline (`libs/chat-shared`)

- [x] 1.1 Extend `baseRehypePlugins`'s `rehypeSanitize` schema in `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx` with tag name `cit` and attribute `dataId` (alongside the existing MathML-tag extension), with a comment explaining the `data-id`-not-`id` clobber-prefix rationale.
- [x] 1.2 Add `cit: () => null` to `defaultMarkdownComponents` in the same file (cast via `as Components` since `cit` isn't a known JSX intrinsic element), so any `MarkdownRenderer` consumer without its own `cit` override hides the tag silently.
- [x] 1.3 Add regression tests to `MarkdownRenderer.spec.tsx`: a `<cit data-id>` element survives sanitization and renders nothing by default; a host-supplied `components.cit` override wins over the default.
- [x] 1.4 Update the `HtmlTagSelector` doc comments in `libs/chat-shared/src/models/annotation.ts` to the paired-tag, `data-id` example (no type/shape change — doc only).

## 2. Drop the regex tag-matching machinery (`libs/quotations`)

- [x] 2.1 Rewrite `libs/quotations/src/utils/citation-injection.ts`: remove `CIT_TAG_RE`, `TRAILING_PARTIAL_CIT_TAG_RE`, `stripTrailingPartialCitTag`, `stripAndReplaceCitTags`. `injectCitationSentinels` keeps filtering out `html_tag` groups (so their index doesn't shift the offset-based ones) but no longer does any tag-text matching/replacement.
- [x] 2.2 Add `stripCitTagsWhileStreaming(content)`: removes every complete `<cit ...>...</cit>` element, then truncates at any remaining dangling `<cit`.
- [x] 2.3 Update `citation-injection.spec.ts`: keep the offset-based regression tests, drop the old tag-replacement tests, add tests for `stripCitTagsWhileStreaming` (no tag, complete pair removed, two pairs removed, dangling open tag truncates, incomplete opening fragment truncates) and for `injectCitationSentinels` skipping `html_tag` groups while preserving flat-array indices for the remaining groups.

## 3. `useCitationMarkdownComponents` — native `cit` element

- [x] 3.1 Add an `isStreaming: boolean` parameter (before `isCompactTypography`) to `useCitationMarkdownComponents`.
- [x] 3.2 `processedContent`: when `isStreaming`, apply `stripCitTagsWhileStreaming`; else keep the existing `injectCitationSentinels` fast-path/non-fast-path split.
- [x] 3.3 Add a `cit` component to the returned `markdownComponents` (built whenever `groups.length > 0`, via a cast since `cit` isn't a JSX intrinsic element): look up the group by the element's `data-id` prop against a `Map` built from `groups`' `html_tag` entries, render `<CitationDropdown>` for a match, `null` otherwise.
- [x] 3.4 Update `useCitationMarkdownComponents.spec.tsx`: update the `Host` test helper to register `rehypeRaw`/`rehypeSanitize` (mirroring production) so `<cit>` tags actually parse; update the signature of every hook call site in the file; remove the old zero-groups tag-stripping test; add a `cit element rendering` describe block covering matched/unmatched/streaming-hides-everything/dangling-tag scenarios.

## 4. Revert streaming carve-out (`useAnnotations`)

- [x] 4.1 Revert `libs/quotations/src/utils/useAnnotations.ts` to unconditional `if (isStreaming) return [];` (remove the `html_tag` filter branch and its comment).
- [x] 4.2 Update `useAnnotations.spec.ts`: replace the two `html_tag`-carve-out tests with the original single "returns an empty array while streaming" test.

## 5. App wiring (`apps/chat`)

- [x] 5.1 Pass `isStreaming` into the `useCitationMarkdownComponents` call in `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` (new parameter position, before `isCompactTypography`).

## 6. Docs

- [x] 6.1 Update `libs/quotations/README.md`: `useAnnotations`, `useCitationMarkdownComponents` (new `isStreaming` param, `cit` override, streaming-hide behavior), and the `Utilities` list (`stripCitTagsWhileStreaming` added, `injectCitationSentinels` description updated); export `stripCitTagsWhileStreaming` from `libs/quotations/src/index.ts`.
- [x] 6.2 Run `npm run validate:docs` and fix any reported drift.

## 7. Verification

- [x] 7.1 Typecheck `libs/chat-shared`, `libs/quotations` (lib + spec projects).
- [x] 7.2 Run full test suites for `libs/chat-shared`, `libs/quotations`; run the `apps/chat` `ConversationMessageItem` test.
- [x] 7.3 Rebuild `libs/chat-shared` and `libs/quotations` dist so downstream consumers pick up the change.
