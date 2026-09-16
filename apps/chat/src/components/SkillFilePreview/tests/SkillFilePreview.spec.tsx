import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { configurePdfWorker } from '../../../utils/pdf';
import { SkillFilePreview } from '../SkillFilePreview';

const { attachmentCanvasBody } = vi.hoisted(() => ({
  attachmentCanvasBody: vi.fn((_props: Record<string, unknown>) => null),
}));

vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  AttachmentCanvasBody: (props: Record<string, unknown>) =>
    attachmentCanvasBody(props),
  useAttachmentCanvas: () => ({
    isLoading: false,
    content: null,
    fileName: 'guide.pdf',
    attachmentId: 'skill/guide.pdf',
  }),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentTheme: 'light' }),
}));

describe('SkillFilePreview', () => {
  it('forwards the app-owned PDF worker initializer to the canvas body', () => {
    render(<SkillFilePreview path="skill/guide.pdf" />);

    expect(attachmentCanvasBody).toHaveBeenCalled();
    expect(attachmentCanvasBody).toHaveBeenCalledWith(
      expect.objectContaining({ configurePdfWorker }),
    );
  });
});
