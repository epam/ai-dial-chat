import { vi } from 'vitest';

vi.mock('@epam/pdf-highlighter-kit', () => ({
  PDFHighlightViewer: () => null,
}));

vi.mock('@epam/ai-dial-react-pdf-highlighter', () => ({
  DocumentPreview: () => null,
  PageThumbnail: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      return key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));
