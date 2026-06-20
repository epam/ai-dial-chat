import { render, screen, waitFor } from '@testing-library/react';
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
    await waitFor(() => expect(screen.getByText('report')).toBeTruthy());
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
