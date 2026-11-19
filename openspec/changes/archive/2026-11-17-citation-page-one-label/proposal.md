## Why

Issue [#9845](https://github.com/epam/ai-dial-chat/issues/9845): since the citation pill started naming the cited page (Issue #9661), the StatGPT Publications table shows `report.pdf, p. 1` next to every publication. StatGPT links each listed document to its first page, so the page there means "the whole document" and the label is noise. The issue reports that the source panel shows no page for these documents.

## What Changes

- `getCitationGroupPage(group)` in `libs/quotations` returns `undefined` when the resolved page is `1`, whether it comes from a `pdf_bbox` / `pdf_region` selector or a `#page=1` URL fragment. Pages 2 and up keep the label (`report.pdf, p. 5`).
- Because the chat app's marker labels and copied text are both built from that function, the pill, its accessible name and the copied citation all read `report.pdf` for page 1.
- Opening the citation is unchanged. The canvas reads the page through `getAnnotationPdfPage` / `parsePdfPageReference`, not this function, so it still opens page 1 and highlights a non-empty box.

## Non-goals

- Distinguishing a whole-document link from a precise citation on page 1. A page-1 citation with a box loses the label too; clicking it still opens page 1 with the highlight.
- Any change to the source panel, the canvas or the backend payload.

## Alternatives considered

- **Hide page 1 only when the annotation has no box**: closer to the intent, but a second rule to keep in sync, and StatGPT's payload shape is not guaranteed. Rejected for consistency.
- **Hide page 1 in the host label builder only**: leaves the lib returning a page the only consumer never shows, and the copy formatter would need the same rule. Rejected.

## Capabilities

### Modified Capabilities

- `citation-marker`: `getCitationGroupPage` returns `undefined` for page 1; the host label scenarios move to page 5 and add a page-1 scenario.
- `quotations-citation-markdown`: the copy scenario uses page 2.

## Impact

- **Libs touched:** `libs/quotations` (`getCitationGroupPage` behaviour, README). No API change.
- **App:** no code change; tests in `apps/chat/src/components/ConversationView/tests/`.
- **Rollback:** revert the commit.
