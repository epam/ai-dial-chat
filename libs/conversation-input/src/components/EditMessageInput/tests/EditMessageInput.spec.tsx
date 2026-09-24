import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditMessageInput } from '../EditMessageInput';

describe('EditMessageInput — external pendingDropFiles', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds attachment card when pendingDropFiles prop is provided', async () => {
    const file = new File(['content'], 'report.pdf', {
      type: 'application/pdf',
    });
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={vi.fn()}
        pendingDropFiles={[file]}
        onDropFilesConsumed={vi.fn()}
      />,
    );
    expect(await screen.findByText('report')).toBeTruthy();
  });

  it('calls onDropFilesConsumed after consuming external files', async () => {
    const onConsumed = vi.fn();
    const file = new File(['content'], 'report.pdf', {
      type: 'application/pdf',
    });
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={vi.fn()}
        pendingDropFiles={[file]}
        onDropFilesConsumed={onConsumed}
      />,
    );
    await waitFor(() => expect(onConsumed).toHaveBeenCalledOnce());
  });

  it('does not call onDropFilesConsumed when pendingDropFiles is empty', () => {
    const onConsumed = vi.fn();
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={vi.fn()}
        pendingDropFiles={[]}
        onDropFilesConsumed={onConsumed}
      />,
    );
    expect(onConsumed).not.toHaveBeenCalled();
  });
});

describe('EditMessageInput — DIAL file system menu item', () => {
  it('does not render the "DIAL file system" item when onDialFileSystemClick is absent', async () => {
    render(<EditMessageInput onCancel={vi.fn()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Add'));
    expect(await screen.findByText('Attach file')).toBeTruthy();
    expect(screen.queryByText('DIAL file system')).toBeNull();
  });

  it('renders the "DIAL file system" item when onDialFileSystemClick is provided', async () => {
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onDialFileSystemClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    expect(await screen.findByText('DIAL file system')).toBeTruthy();
  });

  it('calls onDialFileSystemClick when the item is clicked', async () => {
    const handleClick = vi.fn();
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onDialFileSystemClick={handleClick}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    fireEvent.click(await screen.findByText('DIAL file system'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});

describe('EditMessageInput — message length cap', () => {
  const MAX = 10;

  /*
   * The cap used to be checked only when attachments were disabled, so an
   * oversized edit was submitted silently on attachment-enabled models.
   */
  it('blocks Save & Submit at the cap when attachments are enabled', () => {
    const onSave = vi.fn();
    const onMessageTooLong = vi.fn();
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={onSave}
        isAttachmentsEnabled
        maxMessageLength={MAX}
        message={'x'.repeat(MAX)}
        onMessageTooLong={onMessageTooLong}
      />,
    );

    fireEvent.click(screen.getByText('Save & Submit'));

    expect(onMessageTooLong).toHaveBeenCalledWith(MAX, MAX);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits below the cap', () => {
    const onSave = vi.fn();
    const onMessageTooLong = vi.fn();
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={onSave}
        isAttachmentsEnabled
        maxMessageLength={MAX}
        message={'x'.repeat(MAX - 1)}
        onMessageTooLong={onMessageTooLong}
      />,
    );

    fireEvent.click(screen.getByText('Save & Submit'));

    expect(onMessageTooLong).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });
});

describe('EditMessageInput — skill mentions', () => {
  it('renders a seeded activeMentions range as a highlighted run', () => {
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={vi.fn()}
        message="hello /report world"
        activeMentions={[{ start: 6, length: 7 }]}
      />,
    );

    /* The textarea is aria-hidden while a mention is active — the mirror's
       un-hidden ChatSkill chip carries the accessible name instead — so the
       role query must opt into hidden elements here. */
    const textarea = screen.getByRole('textbox', {
      hidden: true,
    }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('hello /report world');
    expect(screen.getByText('/report')).toBeTruthy();
  });

  it('forwards commandMenu so the slash palette opens inside the edit textarea', async () => {
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={vi.fn()}
        commandMenu={{
          triggerPrefix: '/',
          renderMenu: () => <div>Skills palette</div>,
        }}
      />,
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '/' } });

    expect(await screen.findByText('Skills palette')).toBeTruthy();
  });

  it('forwards menuOverlays to the external add button, even when hideAttachFile is set', async () => {
    render(
      <EditMessageInput
        onCancel={vi.fn()}
        onSave={vi.fn()}
        hideAttachFile
        menuOverlays={[
          {
            key: 'skills',
            title: 'Skills',
            icon: null,
            renderOverlay: () => <div>Skills overlay</div>,
          },
        ]}
      />,
    );

    expect(screen.getByLabelText('Add')).toBeTruthy();
    expect(screen.queryByText('Attach file')).toBeNull();

    fireEvent.click(screen.getByLabelText('Add'));
    fireEvent.click(await screen.findByText('Skills'));

    expect(await screen.findByText('Skills overlay')).toBeTruthy();
  });

  it('renders no add button at all when both hideAttachFile and menuOverlays are absent-equivalent', () => {
    render(
      <EditMessageInput onCancel={vi.fn()} onSave={vi.fn()} hideAttachFile />,
    );

    expect(screen.queryByLabelText('Add')).toBeNull();
  });
});
