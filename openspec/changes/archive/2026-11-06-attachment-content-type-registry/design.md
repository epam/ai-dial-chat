## Decisions

### D1 — A mapped-type strategy table for downloads

```ts
type ContentOf<T extends AttachmentContentType> = Extract<AttachmentCanvasContent, { type: T }>;

interface DownloadStrategy<C> {
  isDownloadable: (content: C) => boolean;
  urlAndMimeType: (content: C) => { url?: string; mimeType?: string };
  download: (content: C, name: string) => void;
}

const DOWNLOAD_STRATEGIES: {
  [T in AttachmentContentType]: DownloadStrategy<ContentOf<T>>;
} = { … };
```

The table is exhaustive by construction. A new `AttachmentContentType` fails to compile until it gets an entry.

The exported functions look the entry up and call it with `content` narrowed to that entry's own type. One `as` on the strategy lookup is unavoidable, because TypeScript cannot correlate the key with the value across a union. That single cast replaces three hand-maintained switches.

Behavior is preserved case by case:

- `downloadAttachmentContent` keeps the empty-text early returns.
- `Error` keeps its `isDownloadable` gate.
- `GroupedVisualizer` and the other non-downloadable kinds do nothing.

### D1a — Shared strategy factories

Text kinds share `textStrategy(mimeType)`, URL kinds share `urlStrategy(isDownloadable, mimeType?)`, and the four non-downloadable kinds share `NOT_DOWNLOADABLE`. This keeps the table exhaustive while staying within `attachment-canvas`'s published-size budget.

### D2 — Lookups, not registries, for the small switches

`bodyContainerClassName` is a pure mapping, so it becomes an exhaustive `Record<AttachmentContentType, string>`.

The open-routing switches in `useOpenAttachmentCanvas` pick which resolver to call. They become:

- `Partial<Record<MIMEType, ResolverKind>>`;
- `Partial<Record<FileExtension, ResolverKind>>`.

`ResolverKind` is an enum of `Pdf`, `Markdown` and `Json`. Each branch's fallback stays in its own code path: Unsupported content for the MIME branch, `false` for the extension branch. A shared table would blur that difference.

### D3 — The renderer switch stays

Each `renderedContent` branch reads a different subset of about 25 values in the component's scope: labels, typography classes, the PDF retry key and reload key, and `isHtmlSourceView`.

A registry of render functions would take one context object with all of them, so a reader could no longer see which values each renderer uses. A component per type would add a props interface per type for no reuse.

The switch is exhaustive over `AttachmentContentType` already, and TypeScript narrows `content` in each branch. It stays.

### D4 — `MIMEType` grows; icons stay in `attachment-input`

The MIME → icon mapping is presentation, so it stays in `attachment-input`. Only the MIME strings move to the shared enum.

New members follow the existing naming (`PDF`, `ZIP`):

- `DOC`, `DOCX`, `XLS`, `XLSX`, `PPT`, `PPTX`;
- `RAR`, `SevenZip`, `TAR`;
- `SQL`, `JSX`, `TSX`, `PHP`, `Rust`, `Vue`.

Adding members is not a breaking change. The icon tables are built on first call, because host tests mock `@tabler/icons-react` partially and a module-level table would read every glyph on import.
