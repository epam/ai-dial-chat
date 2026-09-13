import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownTableCopyFormat } from '../../table-serialization';
import {
  useMarkdownTableActions,
  type MarkdownTableHeaderAction,
} from '../useMarkdownTableActions';

const ACTION_LABELS = {
  copyCsvLabel: 'Copy as CSV',
  copyTxtLabel: 'Copy as TXT',
  copyMarkdownLabel: 'Copy as Markdown',
  copiedLabel: 'Copied!',
  downloadCsvLabel: 'Download as CSV',
  openInCanvasLabel: 'Open in canvas',
};

describe('useMarkdownTableActions', () => {
  it('returns an empty list when actionLabels is undefined', () => {
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: undefined,
        copiedFormat: undefined,
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
        copiedFormat: undefined,
        onCopy: vi.fn(),
        onDownloadCsv: vi.fn(),
      }),
    );

    expect(
      result.current.map((action: MarkdownTableHeaderAction) => action.label),
    ).toEqual([
      ACTION_LABELS.copyCsvLabel,
      ACTION_LABELS.copyTxtLabel,
      ACTION_LABELS.copyMarkdownLabel,
      ACTION_LABELS.downloadCsvLabel,
    ]);
  });

  it('includes the open-in-canvas action when both the label and handler are supplied', () => {
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: ACTION_LABELS,
        copiedFormat: undefined,
        onCopy: vi.fn(),
        onDownloadCsv: vi.fn(),
        onOpenInCanvas: vi.fn(),
      }),
    );

    expect(
      result.current.map((action: MarkdownTableHeaderAction) => action.label),
    ).toContain(ACTION_LABELS.openInCanvasLabel);
  });

  it('omits an action whose label is not supplied', () => {
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: { ...ACTION_LABELS, copyTxtLabel: undefined },
        copiedFormat: undefined,
        onCopy: vi.fn(),
        onDownloadCsv: vi.fn(),
      }),
    );

    expect(
      result.current.map((action: MarkdownTableHeaderAction) => action.label),
    ).not.toContain(ACTION_LABELS.copyTxtLabel);
  });

  it('calls onCopy with the matching format when a copy action is activated', () => {
    const onCopy = vi.fn();
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: ACTION_LABELS,
        copiedFormat: undefined,
        onCopy,
        onDownloadCsv: vi.fn(),
      }),
    );

    const csvAction = result.current.find(
      (action: MarkdownTableHeaderAction) =>
        action.label === ACTION_LABELS.copyCsvLabel,
    );
    csvAction?.onClick();

    expect(onCopy).toHaveBeenCalledWith(MarkdownTableCopyFormat.Csv);
  });

  it('calls onDownloadCsv when the download action is activated', () => {
    const onDownloadCsv = vi.fn();
    const { result } = renderHook(() =>
      useMarkdownTableActions({
        actionLabels: ACTION_LABELS,
        copiedFormat: undefined,
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
