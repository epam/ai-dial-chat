import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OperationLoaderModal from '../OperationLoaderModal';

describe('OperationLoaderModal', () => {
  it('renders the title and text', () => {
    render(
      <OperationLoaderModal
        title="Copying files"
        text="Copying 2 items"
        cancelLabel="Cancel"
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Copying files')).toBeTruthy();
    expect(screen.getByText('Copying 2 items')).toBeTruthy();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();

    render(
      <OperationLoaderModal
        title="Moving files"
        text="Moving 1 item"
        cancelLabel="Cancel"
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('marks the status region as aria-live=polite', () => {
    render(
      <OperationLoaderModal
        title="Copying files"
        text="Copying 2 items"
        cancelLabel="Cancel"
        onCancel={vi.fn()}
      />,
    );

    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
});
