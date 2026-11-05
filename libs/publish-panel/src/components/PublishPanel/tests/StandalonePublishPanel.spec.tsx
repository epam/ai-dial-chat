import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StandalonePublishPanel } from '../StandalonePublishPanel';

/* Records what the shell forwarded, so prop pass-through is assertable without rendering the real body. */
const publishPanelProps = vi.fn();

vi.mock('../PublishPanel', () => ({
  PublishPanel: (props: {
    onChangeFolderClick: () => void;
    onPendingFolderPathChange: (path: string[]) => void;
  }) => {
    publishPanelProps(props);
    return (
      <div>
        <span>Publish panel body</span>
        <button onClick={props.onChangeFolderClick}>Change</button>
        <button onClick={() => props.onPendingFolderPathChange(['Shared'])}>
          Pick Shared
        </button>
      </div>
    );
  },
}));

vi.mock('../PublishFooter', () => ({
  PublishFooter: ({
    onCancel,
    onSubmit,
    view,
    onSelectFolder,
  }: {
    onCancel: () => void;
    onSubmit: () => void;
    view?: string;
    onSelectFolder?: () => void;
  }) => (
    <div>
      <button onClick={onCancel}>Cancel</button>
      {view === 'change-folder' ? (
        <button onClick={onSelectFolder}>Select</button>
      ) : (
        <button onClick={onSubmit}>Publish</button>
      )}
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
      folderItems={[]}
      onSelectedFolderPathChange={vi.fn()}
      onCreateFolder={vi.fn()}
      hasExistingPublicationInFolder={false}
      hasWriteAccess
      isSubmitting={false}
      author=""
      onAuthorChange={vi.fn()}
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

    expect(
      screen.getByRole('dialog', { name: 'Publish' }).matches(':focus'),
    ).toBe(true);
    unmount();
    expect(trigger.matches(':focus')).toBe(true);
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

    expect(
      screen.getByRole('dialog', { name: 'Publish' }).matches(':focus'),
    ).toBe(true);
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

    expect(outside.matches(':focus')).toBe(true);
    outside.remove();
  });

  describe('Tab focus trap', () => {
    /* Waits past the one-frame focus guard the panel installs on open, so the
     * guard cannot be mistaken for the trap under test. */
    const settleOpeningFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    /*
     * Wrapping Tab inside the open panel is the kit drawer's focus manager. It
     * finds tabbable elements by their layout, which jsdom does not have, so
     * the wrap itself is covered by the kit rather than here.
     */

    it('does not trap Tab while focus sits outside the panel', async () => {
      const user = userEvent.setup();
      const outside = document.createElement('button');
      const alsoOutside = document.createElement('button');
      document.body.append(outside, alsoOutside);

      renderPanel();
      await settleOpeningFrame();
      outside.focus();
      await user.tab();

      expect(alsoOutside.matches(':focus')).toBe(true);
      outside.remove();
      alsoOutside.remove();
    });

    it('leaves Tab alone while the panel is closed', async () => {
      const user = userEvent.setup();
      const outside = document.createElement('button');
      const alsoOutside = document.createElement('button');
      document.body.append(outside, alsoOutside);

      renderPanel({ isOpen: false });
      outside.focus();
      await user.tab();

      expect(alsoOutside.matches(':focus')).toBe(true);
      outside.remove();
      alsoOutside.remove();
    });
  });

  it('makes the closed panel inert', () => {
    renderPanel({ isOpen: false });
    const dialog = screen.getByRole('dialog', { hidden: true });
    // inert removes the closed panel from both the tab order and the accessibility tree.
    expect(dialog.hasAttribute('inert')).toBe(true);
  });
  describe('folder view', () => {
    it('drills into the folder view with a Back control and the folder title', async () => {
      renderPanel();

      await userEvent.click(screen.getByRole('button', { name: 'Change' }));

      expect(screen.getByText('Change folder')).toBeTruthy();
      expect(screen.getByLabelText('Back')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy();
    });

    it('commits the picked folder only on Select', async () => {
      const onSelectedFolderPathChange = vi.fn();
      renderPanel({ onSelectedFolderPathChange });

      await userEvent.click(screen.getByRole('button', { name: 'Change' }));
      await userEvent.click(
        screen.getByRole('button', { name: 'Pick Shared' }),
      );
      expect(onSelectedFolderPathChange).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Select' }));

      expect(onSelectedFolderPathChange).toHaveBeenCalledWith(['Shared']);
      expect(screen.queryByLabelText('Back')).toBeNull();
    });

    it('returns to the main view on Cancel without committing or closing', async () => {
      const onSelectedFolderPathChange = vi.fn();
      const onClose = vi.fn();
      renderPanel({ onSelectedFolderPathChange, onClose });

      await userEvent.click(screen.getByRole('button', { name: 'Change' }));
      await userEvent.click(
        screen.getByRole('button', { name: 'Pick Shared' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onSelectedFolderPathChange).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
    });
  });

  it('forwards the author props through to the inner publish panel unmodified', () => {
    const onAuthorChange = vi.fn();
    renderPanel({ author: 'DIAL Team', onAuthorChange });

    expect(publishPanelProps).toHaveBeenCalledWith(
      expect.objectContaining({ author: 'DIAL Team', onAuthorChange }),
    );
  });
});
