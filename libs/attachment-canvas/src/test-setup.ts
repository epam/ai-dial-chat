// Vitest setup for attachment-canvas
import { vi } from 'vitest';

vi.mock('@epam/pdf-highlighter-kit', () => ({
  PDFHighlightViewer: () => null,
}));

vi.mock('@epam/ai-dial-react-pdf-highlighter', () => ({
  DocumentPreview: () => null,
  PageThumbnail: () => null,
}));
