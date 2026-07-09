import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CatalogI18nKeys } from '../../../constants/translation-keys';
import CatalogPickerModal from '../CatalogPickerModal';

vi.mock('../../CatalogView/CatalogView', () => ({
  default: ({
    isPickerMode,
    onClose,
  }: {
    isPickerMode?: boolean;
    onClose?: () => void;
  }) => (
    <div>
      <output aria-label="isPickerMode">{String(!!isPickerMode)}</output>
      <button type="button" onClick={onClose}>
        close from catalog view
      </button>
    </div>
  ),
}));

describe('CatalogPickerModal', () => {
  it('renders nothing when closed', () => {
    render(<CatalogPickerModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('isPickerMode')).toBeNull();
  });

  it('shows the modal title when open', async () => {
    render(<CatalogPickerModal isOpen onClose={vi.fn()} />);
    expect(await screen.findByText(CatalogI18nKeys.PickerTitle)).toBeTruthy();
  });

  it('renders CatalogView in picker mode when open', async () => {
    render(<CatalogPickerModal isOpen onClose={vi.fn()} />);
    expect((await screen.findByLabelText('isPickerMode')).textContent).toBe(
      'true',
    );
  });

  it('closes when CatalogView selects a card', async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    render(<CatalogPickerModal isOpen onClose={onClose} />);

    await user.click(
      await screen.findByRole('button', { name: 'close from catalog view' }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });
});
