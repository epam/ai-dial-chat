import { describe, expect, it, vi } from 'vitest';

import { ChatI18nKeys } from '@/src/constants/i18n';

import {
  getSaveSubmitTooltipText,
  isSaveSubmitTooltipHidden,
} from '../saveSubmitTooltip';

const t = vi.fn((key: string) => key);

describe('isSaveSubmitTooltipHidden', () => {
  it('hides tooltip when all conditions are false', () => {
    expect(
      isSaveSubmitTooltipHidden({
        isUploadingAttachmentPresent: false,
        isContentEmptyAndNoAttachments: false,
        isTranscribing: false,
      }),
    ).toBe(true);
  });

  it('hides tooltip when isTranscribing is omitted', () => {
    expect(
      isSaveSubmitTooltipHidden({
        isUploadingAttachmentPresent: false,
        isContentEmptyAndNoAttachments: false,
      }),
    ).toBe(true);
  });

  it('shows tooltip when attachment is uploading', () => {
    expect(
      isSaveSubmitTooltipHidden({
        isUploadingAttachmentPresent: true,
        isContentEmptyAndNoAttachments: false,
        isTranscribing: false,
      }),
    ).toBe(false);
  });

  it('shows tooltip when content is empty', () => {
    expect(
      isSaveSubmitTooltipHidden({
        isUploadingAttachmentPresent: false,
        isContentEmptyAndNoAttachments: true,
        isTranscribing: false,
      }),
    ).toBe(false);
  });

  it('shows tooltip when transcribing', () => {
    expect(
      isSaveSubmitTooltipHidden({
        isUploadingAttachmentPresent: false,
        isContentEmptyAndNoAttachments: false,
        isTranscribing: true,
      }),
    ).toBe(false);
  });

  it('shows tooltip when multiple conditions are true', () => {
    expect(
      isSaveSubmitTooltipHidden({
        isUploadingAttachmentPresent: true,
        isContentEmptyAndNoAttachments: true,
        isTranscribing: true,
      }),
    ).toBe(false);
  });
});

describe('getSaveSubmitTooltipText', () => {
  it('returns WaitForAttachmentToLoad when attachment is uploading', () => {
    expect(
      getSaveSubmitTooltipText(
        {
          isUploadingAttachmentPresent: true,
          isContentEmptyAndNoAttachments: false,
        },
        t,
      ),
    ).toBe(ChatI18nKeys.WaitForAttachmentToLoad);
  });

  it('returns PleaseTypeMessage when content is empty', () => {
    expect(
      getSaveSubmitTooltipText(
        {
          isUploadingAttachmentPresent: false,
          isContentEmptyAndNoAttachments: true,
        },
        t,
      ),
    ).toBe(ChatI18nKeys.PleaseTypeMessage);
  });

  it('returns TranscribingAudio when transcribing', () => {
    expect(
      getSaveSubmitTooltipText(
        {
          isUploadingAttachmentPresent: false,
          isContentEmptyAndNoAttachments: false,
          isTranscribing: true,
        },
        t,
      ),
    ).toBe(ChatI18nKeys.TranscribingAudio);
  });

  it('prioritises uploading over empty content', () => {
    expect(
      getSaveSubmitTooltipText(
        {
          isUploadingAttachmentPresent: true,
          isContentEmptyAndNoAttachments: true,
          isTranscribing: true,
        },
        t,
      ),
    ).toBe(ChatI18nKeys.WaitForAttachmentToLoad);
  });

  it('prioritises empty content over transcribing', () => {
    expect(
      getSaveSubmitTooltipText(
        {
          isUploadingAttachmentPresent: false,
          isContentEmptyAndNoAttachments: true,
          isTranscribing: true,
        },
        t,
      ),
    ).toBe(ChatI18nKeys.PleaseTypeMessage);
  });
});
