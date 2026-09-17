import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useMarkdownTableActions,
  type MarkdownTableHeaderAction,
} from '../useMarkdownTableActions';

const ACTION_LABELS = {
  copyLabel: 'Copy',
  copiedLabel: 'Copied!',
  downloadCsvLabel: 'Download as CSV',
  openInCanvasLabel: 'Open in canvas',
};

describe('useMarkdownTableActions', () => {
  it('returns an empty list when actionLabels is undefined', () => {
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: undefined,
        isCopied: false,
        onCopy: vi.fn(),
        onDownloadCsv: vi.fn(),
      }),
    );

    expect(result.current).toEqual([]);
  });

  it('builds one action per supplied label, omitting open-in-canvas without a handler', () => {
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: ACTION_LABELS,
        isCopied: false,
        onCopy: vi.fn(),
        onDownloadCsv: vi.fn(),
      }),
    );

    expect(
      result.current.map((action: MarkdownTableHeaderAction) => action.label),
    ).toEqual([ACTION_LABELS.copyLabel, ACTION_LABELS.downloadCsvLabel]);
  });

  it('includes the open-in-canvas action when both the label and handler are supplied', () => {
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: ACTION_LABELS,
        isCopied: false,
        onCopy: vi.fn(),
        onDownloadCsv: vi.fn(),
        onOpenInCanvas: vi.fn(),
      }),
    );

    expect(
      result.current.map((action: MarkdownTableHeaderAction) => action.label),
    ).toContain(ACTION_LABELS.openInCanvasLabel);
  });

  it('omits the copy action when copyLabel is not supplied', () => {
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: { ...ACTION_LABELS, copyLabel: undefined },
        isCopied: false,
        onCopy: vi.fn(),
        onDownloadCsv: vi.fn(),
      }),
    );

    expect(
      result.current.map((action: MarkdownTableHeaderAction) => action.label),
    ).not.toContain(ACTION_LABELS.copyLabel);
  });

  it('calls onCopy when the copy action is activated', () => {
    const onCopy = vi.fn();
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: ACTION_LABELS,
        isCopied: false,
        onCopy,
        onDownloadCsv: vi.fn(),
      }),
    );

    const copyAction = result.current.find(
      (action: MarkdownTableHeaderAction) =>
        action.label === ACTION_LABELS.copyLabel,
    );
    copyAction?.onClick();

    expect(onCopy).toHaveBeenCalledOnce();
  });

  it('calls onDownloadCsv when the download action is activated', () => {
    const onDownloadCsv = vi.fn();
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: ACTION_LABELS,
        isCopied: false,
        onCopy: vi.fn(),
        onDownloadCsv,
      }),
    );

    const downloadAction = result.current.find(
      (action: MarkdownTableHeaderAction) =>
        action.label === ACTION_LABELS.downloadCsvLabel,
    );
    downloadAction?.onClick();

    expect(onDownloadCsv).toHaveBeenCalledOnce();
  });
});
