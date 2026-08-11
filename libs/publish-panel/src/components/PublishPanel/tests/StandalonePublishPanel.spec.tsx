import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StandalonePublishPanel } from '../StandalonePublishPanel';

vi.mock('../PublishPanel', () => ({
  PublishPanel: () => <span>Publish panel body</span>,
}));

vi.mock('../PublishFooter', () => ({
  PublishFooter: ({
    onCancel,
    onSubmit,
  }: {
    onCancel: () => void;
    onSubmit: () => void;
  }) => (
    <div>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onSubmit}>Publish</button>
    </div>
  ),
}));

const renderPanel = (
  props?: Partial<Parameters<typeof StandalonePublishPanel>[0]>,
) =>
  render(
    <StandalonePublishPanel
      isOpen
      resource={{ title: 'Q3 planning notes' }}
      history={[]}
      folderItems={[]}
      onSelectedFolderPathChange={vi.fn()}
      onCreateFolder={vi.fn()}
      hasExistingPublicationInFolder={false}
      hasWriteAccess
      isSubmitting={false}
      rules={[]}
      onRulesChange={vi.fn()}
      ruleSourceOptions={[]}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      {...props}
    />,
  );

describe('StandalonePublishPanel', () => {
  it('renders a Close button and no Back control', () => {
    renderPanel();
    expect(screen.getByLabelText('Close')).toBeTruthy();
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('disables the Close button while submitting', () => {
    renderPanel({ isSubmitting: true });
    expect(screen.getByLabelText('Close').hasAttribute('disabled')).toBe(true);
  });

  it('calls onClose when the Close button is clicked', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    await userEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Cancel is clicked, same as Close', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose on Escape when the panel is closed', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose, isOpen: false });
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onSubmit when Publish is clicked', async () => {
    const onSubmit = vi.fn();
    renderPanel({ onSubmit });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('renders the dialog role and aria-label', () => {
    renderPanel();
    expect(screen.getByRole('dialog', { name: 'Publish' })).toBeTruthy();
  });

  it('moves focus into the dialog and restores it when unmounted', () => {
    const returnFocusRef = createRef<HTMLButtonElement>();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    returnFocusRef.current = trigger;
    trigger.focus();

    const { unmount } = renderPanel({ returnFocusRef });

    expect(document.activeElement).toBe(
      screen.getByRole('dialog', { name: 'Publish' }),
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('keeps focus in the dialog when the opening menu hands focus back to its trigger', async () => {
    /*
     * Reproduces the floating-ui dropdown that launches the panel: it restores
     * focus to its own trigger from a microtask queued as it unmounts, which
     * runs after the panel's mount effect.
     */
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    renderPanel();
    queueMicrotask(() => trigger.focus({ preventScroll: true }));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(document.activeElement).toBe(
      screen.getByRole('dialog', { name: 'Publish' }),
    );
    trigger.remove();
  });

  it('leaves focus alone once the opening frame has passed', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);

    renderPanel();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    outside.focus();

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('makes the closed panel inert', () => {
    renderPanel({ isOpen: false });
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.hasAttribute('inert')).toBe(true);
    expect(dialog.getAttribute('aria-hidden')).toBe('true');
  });
});
