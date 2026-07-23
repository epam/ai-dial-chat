import { render, screen } from '@testing-library/react';
import type { Ref } from 'react';
import {
  createRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsStepHandle } from '../SettingsStep';
import SettingsStep from '../SettingsStep';

const mockTriggerSave = vi.fn();
let previewChatMountCount = 0;

vi.mock('../AppEditorIframe', () => ({
  default: forwardRef(function MockAppEditorIframe(
    _props: unknown,
    ref: Ref<{ triggerSave: typeof mockTriggerSave }>,
  ) {
    useImperativeHandle(ref, () => ({ triggerSave: mockTriggerSave }));
    return <div>iframe-content</div>;
  }),
}));

vi.mock('../AppPreviewChat', () => ({
  default: ({ appId }: { appId: string }) => {
    /* Each mount increments the shared counter once, letting tests detect a
     * remount (as opposed to a re-render of the same instance) triggered by
     * the `key={previewResetKey}` this component is given in SettingsStep. */
    const hasCountedRef = useRef(false);
    useEffect(() => {
      if (!hasCountedRef.current) {
        hasCountedRef.current = true;
        previewChatMountCount += 1;
      }
    }, []);
    return <div>preview-chat-{appId}</div>;
  },
}));

const SCHEMA = {
  id: 'quickapps2-schema',
  displayName: 'QuickApp',
  editorUrl: 'https://editor.example.com',
};

describe('SettingsStep', () => {
  beforeEach(() => {
    previewChatMountCount = 0;
  });

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

  it('forwards the general payload from triggerSave to the embedded iframe', () => {
    const ref = createRef<SettingsStepHandle>();
    render(<SettingsStep schema={SCHEMA} appId="abc" ref={ref} />);

    ref.current?.triggerSave({ name: 'My App' });

    expect(mockTriggerSave).toHaveBeenCalledWith({ name: 'My App' });
  });

  it('remounts the preview pane when previewResetKey changes', () => {
    const { rerender } = render(
      <SettingsStep schema={SCHEMA} appId="abc" previewResetKey={0} />,
    );
    expect(previewChatMountCount).toBe(1);

    rerender(<SettingsStep schema={SCHEMA} appId="abc" previewResetKey={0} />);
    expect(previewChatMountCount).toBe(1);

    rerender(<SettingsStep schema={SCHEMA} appId="abc" previewResetKey={1} />);
    expect(previewChatMountCount).toBe(2);
  });
});
