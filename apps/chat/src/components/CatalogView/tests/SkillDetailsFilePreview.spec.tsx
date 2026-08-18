import {
  AttachmentContentType,
  AttachmentErrorType,
} from '@epam/ai-dial-attachment-canvas';
import { render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillDetailsFilePreview } from '../SkillDetailsFilePreview';

const { openCanvas, useSkillFilePreviewSync } = vi.hoisted(() => ({
  openCanvas: vi.fn(),
  useSkillFilePreviewSync: vi.fn(),
}));

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>()),
  useAttachmentCanvas: () => ({ openCanvas }),
}));

vi.mock('../../../hooks/attachment/useSkillFilePreviewSync', () => ({
  useSkillFilePreviewSync,
}));

vi.mock('../../SkillFilePreview/SkillFilePreview', () => ({
  SkillFilePreview: ({ path }: { path: string }) => (
    <div>{`Shared attachment preview: ${path}`}</div>
  ),
}));

describe('SkillDetailsFilePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPreview = (
    overrides: Partial<ComponentProps<typeof SkillDetailsFilePreview>> = {},
  ) => {
    const props: ComponentProps<typeof SkillDetailsFilePreview> = {
      fileId: 'skill/files/openai.yaml',
      fileName: 'openai.yaml',
      onLoadFile: vi.fn().mockResolvedValue({
        bytes: new TextEncoder().encode('name: example'),
      }),
      ...overrides,
    };
    return { props, ...render(<SkillDetailsFilePreview {...props} />) };
  };

  it('feeds downloaded bytes into the shared Skill Builder sync and renderer', async () => {
    const { props } = renderPreview();

    expect(
      screen.getByText('Shared attachment preview: skill/files/openai.yaml'),
    ).toBeTruthy();
    await waitFor(() => expect(props.onLoadFile).toHaveBeenCalledOnce());
    await waitFor(() => {
      const latestCall = useSkillFilePreviewSync.mock.calls.at(-1)?.[0];
      expect(latestCall?.files).toEqual([
        {
          path: 'skill/files/openai.yaml',
          name: 'openai.yaml',
          kind: 'file',
        },
      ]);
      const content = latestCall?.filesContentRef.current.get(
        'skill/files/openai.yaml',
      );
      expect(content).toBeDefined();
      expect(new TextDecoder().decode(content?.bytes)).toBe('name: example');
    });
  });

  it('maps a forbidden download to the attachment-canvas forbidden state', async () => {
    renderPreview({
      onLoadFile: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('Forbidden'), { status: 403 }),
        ),
    });

    await waitFor(() =>
      expect(openCanvas).toHaveBeenCalledWith(
        {
          type: AttachmentContentType.Error,
          errorType: AttachmentErrorType.Forbidden,
        },
        'openai.yaml',
        'skill/files/openai.yaml',
      ),
    );
  });

  it('maps other download failures to the attachment-canvas load-error state', async () => {
    renderPreview({
      onLoadFile: vi.fn().mockRejectedValue(new Error('Failed')),
    });

    await waitFor(() =>
      expect(openCanvas).toHaveBeenCalledWith(
        {
          type: AttachmentContentType.Error,
          errorType: AttachmentErrorType.LoadFailed,
        },
        'openai.yaml',
        'skill/files/openai.yaml',
      ),
    );
  });
});
