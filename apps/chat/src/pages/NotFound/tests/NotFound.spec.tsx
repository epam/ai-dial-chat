import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import { ROUTES } from '../../../types/routes';
import NotFoundPage from '../NotFound';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('NotFoundPage', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers catalog and chat recovery actions', async () => {
    render(<NotFoundPage />);

    expect(
      screen.getByRole('region', { name: NotFoundI18nKeys.AriaLabel }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: NotFoundI18nKeys.OpenCatalog }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Catalog);

    await user.click(
      screen.getByRole('button', { name: NotFoundI18nKeys.NewChat }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Root);
  });
});
