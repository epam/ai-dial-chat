import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import SettingsStep from '../SettingsStep';

vi.mock('../AppEditorIframe', () => ({
  default: forwardRef(function MockAppEditorIframe(
    _props: unknown,
    _ref: unknown,
  ) {
    return <div>iframe-content</div>;
  }),
}));

vi.mock('../AppPreviewChat', () => ({
  default: ({ appId }: { appId: string }) => <div>preview-chat-{appId}</div>,
}));

const SCHEMA = {
  id: 'quickapps2-schema',
  displayName: 'QuickApp',
  editorUrl: 'https://editor.example.com',
};

describe('SettingsStep', () => {
  it('keeps both the iframe and the preview pane mounted regardless of isPreviewing', () => {
    const { rerender } = render(
      <SettingsStep schema={SCHEMA} appId="abc" isPreviewing={false} />,
    );

    expect(screen.getByText('iframe-content')).toBeTruthy();
    expect(screen.getByText('preview-chat-abc')).toBeTruthy();

    rerender(<SettingsStep schema={SCHEMA} appId="abc" isPreviewing />);

    expect(screen.getByText('iframe-content')).toBeTruthy();
    expect(screen.getByText('preview-chat-abc')).toBeTruthy();
  });

  it('hides the preview pane behind a hidden wrapper when not previewing', () => {
    const { container } = render(
      <SettingsStep schema={SCHEMA} appId="abc" isPreviewing={false} />,
    );

    const previewWrapper = screen.getByText('preview-chat-abc').parentElement;
    expect(previewWrapper?.className).toContain('hidden');

    const iframeWrapper = screen.getByText('iframe-content').parentElement;
    expect(iframeWrapper?.className).not.toContain('hidden');
    expect(container).toBeTruthy();
  });

  it('hides the iframe wrapper (not the preview pane) when previewing', () => {
    render(<SettingsStep schema={SCHEMA} appId="abc" isPreviewing />);

    const previewWrapper = screen.getByText('preview-chat-abc').parentElement;
    expect(previewWrapper?.className).not.toContain('hidden');

    const iframeWrapper = screen.getByText('iframe-content').parentElement;
    expect(iframeWrapper?.className).toContain('hidden');
  });

  it('does not render the preview pane when appId is empty', () => {
    render(<SettingsStep schema={SCHEMA} appId="" isPreviewing={false} />);

    expect(screen.queryByText(/preview-chat-/)).toBeNull();
  });
});
