import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeploymentSelectorI18nKeys } from '../../../constants/translation-keys';
import CatalogModal from '../CatalogModal';

vi.mock('../../CatalogView/CatalogView', () => ({
  default: ({
    isSelectorMode,
    onClose,
  }: {
    isSelectorMode?: boolean;
    onClose?: () => void;
  }) => (
    <div>
      <output aria-label="isSelectorMode">{String(!!isSelectorMode)}</output>
      <button type="button" onClick={onClose}>
        close from catalog view
      </button>
    </div>
  ),
}));

describe('CatalogModal', () => {
  it('renders nothing when closed', () => {
    render(<CatalogModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('isSelectorMode')).toBeNull();
  });

  it('shows the modal title when open', async () => {
    render(<CatalogModal isOpen onClose={vi.fn()} />);
    expect(
      await screen.findByText(DeploymentSelectorI18nKeys.Title),
    ).toBeTruthy();
  });

  it('renders CatalogView in picker mode when open', async () => {
    render(<CatalogModal isOpen onClose={vi.fn()} />);
    expect((await screen.findByLabelText('isSelectorMode')).textContent).toBe(
      'true',
    );
  });

  it('closes when CatalogView selects a card', async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    render(<CatalogModal isOpen onClose={onClose} />);

    await user.click(
      await screen.findByRole('button', { name: 'close from catalog view' }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });
});
