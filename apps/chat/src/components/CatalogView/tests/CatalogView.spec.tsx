import type { CreateOption } from '@epam/ai-dial-catalog';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogI18nKeys } from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import useFavoriteApplications from '../../../hooks/useFavoriteApplications/useFavoriteApplications';
import { ROUTES } from '../../../types/routes';
import CatalogView from '../CatalogView';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@epam/ai-dial-catalog', () => ({
  CatalogEntityType: {
    Model: 'MODEL',
    Application: 'APPLICATION',
    Toolset: 'TOOLSET',
  },
  Catalog: ({ createOptions }: { createOptions?: CreateOption[] }) => (
    <div>
      {(createOptions ?? []).map((option) => (
        <button key={option.label} type="button" onClick={option.onClick}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock(
  '../../../hooks/useFavoriteApplications/useFavoriteApplications',
  () => ({
    default: vi.fn(),
  }),
);

describe('CatalogView', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeployments).mockReturnValue({
      items: [],
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
    });
    vi.mocked(useNotification).mockReturnValue({
      notifications: [],
      showNotification: vi.fn(),
      dismissNotification: vi.fn(),
    });
    vi.mocked(useFavoriteApplications).mockReturnValue({
      favoriteIds: new Set(),
      isLoading: false,
      toggleFavorite: vi.fn(),
    });
  });

  it('renders Create Toolset action even when application schemas are absent', async () => {
    render(<CatalogView />);

    await user.click(
      screen.getByRole('button', {
        name: CatalogI18nKeys.CreateToolset,
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      `${ROUTES.ToolsetEditor}?returnUrl=%2Fcatalog`,
    );
  });
});
