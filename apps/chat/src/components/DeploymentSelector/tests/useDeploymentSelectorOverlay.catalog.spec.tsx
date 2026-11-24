import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useAppConfig as mockUseAppConfig,
  useFeatureFlag as mockUseFeatureFlag,
} from '../../../context/tests/app-config-context-mock';
import { useDeploymentSelectorFieldOverlay } from '../useDeploymentSelectorFieldOverlay';
import { useDeploymentSelectorOverlay } from '../useDeploymentSelectorOverlay';

const mocks = vi.hoisted(() => ({ isAfterLoadIdle: false }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
mockUseAppConfig.mockImplementation(() => ({
  config: { defaultDeploymentId: 'default-model' },
}));
mockUseFeatureFlag.mockImplementation(() => false);
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: [],
    selectedItemId: null,
    setSelectedItemId: vi.fn(),
  }),
}));
vi.mock('../../../context/FavoriteApplicationsContext', () => ({
  useFavoriteApplications: () => ({
    favoriteIds: new Set<string>(),
    toggleFavorite: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: () => true,
}));
vi.mock('../../../hooks/language/useLanguage', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../../hooks/language/useLanguage')
  >()),
  useLanguage: () => ({ language: 'en' }),
}));
vi.mock('../../../hooks/useIsAfterLoadIdle', () => ({
  useIsAfterLoadIdle: () => mocks.isAfterLoadIdle,
}));
vi.mock('../DeploymentSelectorOverlay', () => ({
  default: ({ onBrowseCatalog }: { onBrowseCatalog: () => void }) => (
    <button onClick={onBrowseCatalog}>Browse catalog</button>
  ),
}));
vi.mock('../CatalogModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (
    <p>{isOpen ? 'Model catalog open' : 'Model catalog closed'}</p>
  ),
}));

const ConversationPicker = () => {
  const picker = useDeploymentSelectorOverlay();
  return (
    <>
      {picker.renderOverlay(vi.fn())}
      {picker.catalogModal}
    </>
  );
};

const FieldPicker = () => {
  const picker = useDeploymentSelectorFieldOverlay(null, vi.fn());
  return (
    <>
      {picker.renderOverlay(vi.fn())}
      {picker.catalogModal}
    </>
  );
};

describe.each([
  ['useDeploymentSelectorOverlay', ConversationPicker],
  ['useDeploymentSelectorFieldOverlay', FieldPicker],
])('%s — catalog modal mounting', (_, Harness) => {
  beforeEach(() => {
    mocks.isAfterLoadIdle = false;
  });

  it('does not mount the catalog modal while the page loads and the catalog is closed', async () => {
    render(<Harness />);
    await screen.findByRole('button', { name: 'Browse catalog' });

    expect(screen.queryByText(/Model catalog/)).toBeNull();
  });

  it('mounts the catalog modal when the catalog is browsed', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      await screen.findByRole('button', { name: 'Browse catalog' }),
    );

    expect(await screen.findByText('Model catalog open')).toBeTruthy();
  });

  it('mounts the catalog modal closed once the page has loaded', async () => {
    mocks.isAfterLoadIdle = true;
    render(<Harness />);

    expect(await screen.findByText('Model catalog closed')).toBeTruthy();
  });
});
