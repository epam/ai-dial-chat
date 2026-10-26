## Context

Quick Apps and the DIAL Loop editor each copy an add-on picker, an attached-item row and a remove-focus hook
built on `@epam/ai-dial-catalog` (see the proposal). The lib already owns the parts they compose:
`CatalogPickerModal` (`listProps`), `ListView` in `CatalogSelectionMode.Multiple` and `CredentialsBadge`.

## Decisions

1. **The picker wraps `CatalogPickerModal` and does not extend it.** `CatalogPickerModal` stays
   selection-agnostic. `AddOnCatalogModal` owns only the checked set and the commit rule, and passes
   everything else through (`labels`, `status`, `error`, `onRetry` and the remaining `listProps`).
   `renderFooterStart(checked)` replaces `footerStart`, because a host's note, such as "this skill stays
   private", depends on what is checked.
2. **The selection rule is a pure function in `./mapping`.** Hosts that do not render the dialog, or that
   write ids through their own form, can still apply the same rule.
3. **The row is named by the item.** The button's name comes from the visible name and version
   (`aria-labelledby`), and the line below describes it. This avoids a separate "details" string that each
   host would have to translate the same way. A location row has no visible name, so its button takes
   `aria-label={name}`.
4. **The row takes `CatalogItemCredentials`, not a badge node.** This matches `ListView`'s own badge input.
   The host resolves the status, as it already does for the list.
5. **The row's type and color are props** (`titleClassName`, `versionClassName`, `descriptionClassName`),
   per `.claude/rules/libs.md`, with defaults taken from the hosts' current rows.
6. **The focus hook triggers on a shorter count.** Hosts remove synchronously (Quick Apps) or after a
   confirm or a save (the editor). A drop in the count covers both, and it acts only when focus has fallen
   to the body.

## Lib boundary

No host data shape enters the lib. Hosts map their entities to `CatalogItem`, resolve icon URLs and
credentials, translate labels, and write the confirmed ids to their own documents.

## Risks

- `ItemHeader` renders an `h3` inside the row's button. Button content is presentational to assistive tech,
  but the HTML is not valid. This is accepted for parity with the list's Name cell. A follow-up can give
  `ItemHeader` a non-heading element option.
