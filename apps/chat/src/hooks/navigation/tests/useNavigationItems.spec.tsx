import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { renderHook } from '@testing-library/react';
import type { FC, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION_CONFIG } from '../../../constants/navigation';
import { ButtonsI18nKeys } from '../../../constants/translation-keys';
import { ROUTES } from '../../../types/routes';
import * as useUiFeatureModule from '../../useUiFeature';
import * as visibleNavItemsModule from '../../useVisibleNavItems';
import { useNavigationItems } from '../useNavigationItems';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../useUiFeature');
vi.mock('../../useVisibleNavItems');

const setup = ({
  isNewConversationHidden = false,
}: { isNewConversationHidden?: boolean } = {}) => {
  vi.mocked(useUiFeatureModule.useUiFeature).mockImplementation(
    (feature: OverlayFeature) =>
      feature === OverlayFeature.HideNewConversation && isNewConversationHidden,
  );
  vi.mocked(visibleNavItemsModule.useVisibleNavItems).mockReturnValue(
    NAVIGATION_CONFIG,
  );
};

const getNavItems = (pathname: string) => {
  const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
  );
  return renderHook(() => useNavigationItems(), { wrapper }).result.current;
};

const findRoot = (items: ReturnType<typeof getNavItems>) =>
  items.find(({ id }) => id === ROUTES.Root);

describe('useNavigationItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('presents the root item as New chat', () => {
    expect(findRoot(getNavItems(ROUTES.Root))?.label).toBe(
      ButtonsI18nKeys.NewChat,
    );
  });

  it('marks New chat active only on /', () => {
    expect(findRoot(getNavItems(ROUTES.Root))?.isActive).toBe(true);
    expect(findRoot(getNavItems(`${ROUTES.Conversations}/abc`))?.isActive).toBe(
      false,
    );
  });

  it('gives the root item a filled variant for its active state', () => {
    expect(findRoot(getNavItems(ROUTES.Root))?.activeIcon).toBeDefined();
  });

  it('drops the root item under hide-new-conversation', () => {
    setup({ isNewConversationHidden: true });

    expect(findRoot(getNavItems(ROUTES.Root))).toBeUndefined();
  });

  it('keeps the other items and their prefix matching', () => {
    const items = getNavItems(ROUTES.Catalog);

    expect(items.find(({ id }) => id === ROUTES.Catalog)?.isActive).toBe(true);
    expect(items.length).toBe(NAVIGATION_CONFIG.length);
  });

  it('keeps Projects active on the New project page', () => {
    const items = getNavItems(ROUTES.ProjectCreate);

    expect(items.find(({ id }) => id === ROUTES.Projects)?.isActive).toBe(true);
  });
});
