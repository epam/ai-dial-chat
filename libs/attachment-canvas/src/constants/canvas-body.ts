import { AttachmentContentType } from '../types/attachment-canvas';

const CENTERED_PADDED =
  'h-full overflow-auto p-4 flex items-center justify-center';
const CLIPPED = 'h-full overflow-hidden';

/** Layout classes of the canvas body container, per content type. */
export const BODY_CONTAINER_CLASS_NAMES: Record<AttachmentContentType, string> =
  {
    [AttachmentContentType.PlainText]: 'h-full overflow-auto p-4',
    [AttachmentContentType.Image]: CENTERED_PADDED,
    [AttachmentContentType.Audio]: CENTERED_PADDED,
    [AttachmentContentType.Unsupported]: CENTERED_PADDED,
    [AttachmentContentType.Error]: CENTERED_PADDED,
    [AttachmentContentType.Json]: 'h-full overflow-auto',
    [AttachmentContentType.Pdf]: CLIPPED,
    [AttachmentContentType.Ooxml]: CLIPPED,
    [AttachmentContentType.Visualizer]: CLIPPED,
    [AttachmentContentType.GroupedVisualizer]: CLIPPED,
    [AttachmentContentType.McpApp]: CLIPPED,
    [AttachmentContentType.Code]: CLIPPED,
    [AttachmentContentType.Html]: CLIPPED,
    /*
     * A markdown document flows as tall as its content, so the body root is
     * the scroller. `MarkdownTable` is the opposite case — a single table
     * that fills the panel and scrolls inside its own wrapper — so it keeps
     * the clipped flex column. The scroller carries no padding of its own:
     * a code block's sticky header pins to the scroller's padding edge, so
     * padding here would leave a strip above the pinned header where the
     * scrolled code shows through. The inset sits on an inner wrapper.
     */
    [AttachmentContentType.Markdown]: 'h-full overflow-auto',
    [AttachmentContentType.MarkdownTable]:
      'flex h-full min-h-0 flex-col overflow-hidden p-4',
  };
