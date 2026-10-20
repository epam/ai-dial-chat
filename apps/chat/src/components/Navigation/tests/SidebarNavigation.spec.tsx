import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  NavigationSidebarVariant,
  UserMenuTriggerVariant,
} from '@epam/ai-dial-navigation-panel';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AriaAttributes, ComponentProps, ReactNode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_SIDEBAR_ID } from '../../../constants/layout';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  NavigationI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import { logout } from '../../../server-api/auth.api';
import { AuthStatus } from '../../../types/auth-status';
import { ROUTES } from '../../../types/routes';
import { UserConfigStatus } from '../../../types/user-config-status';
import SidebarNavigation from '../SidebarNavigation';

vi.mock('../../../hooks/useUiFeature');

const viewport = vi.hoisted(() => ({ isMobile: false }));

vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => viewport.isMobile,
}));

/* The shipped locale list is data, not behaviour under test: the app ships
   English only today, which hides the language group outright. Two locales
   keep the group renderable so its feature gating stays observable; the
   single-locale case gets its own test by trimming this array. */
const { supportedLanguages } = vi.hoisted(() => ({
  supportedLanguages: [] as { code: string; nativeName: string }[],
}));

const resetSupportedLanguages = () =>
  supportedLanguages.splice(
    0,
    supportedLanguages.length,
    { code: 'en', nativeName: 'English' },
    { code: 'de', nativeName: 'Deutsch' },
  );

vi.mock('../../../hooks/language/useLanguage', () => ({
  SUPPORTED_LANGUAGES: supportedLanguages,
  useLanguage: () => ({ language: 'en', changeLanguage: vi.fn() }),
}));

interface MockDropdownItem {
  key: string;
  label?: ReactNode;
  onClick?: () => void;
  children?: MockDropdownItem[];
}

/* The real Dropdown renders into a floating overlay; the mock renders items
   inline so the assertions stay about menu content, not positioning. */
/* The mobile sheet is the real kit `BottomSheet`; the rest stays stubbed. */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const { BottomSheet } =
    await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    BottomSheet,
    DIAL_KIT_ICON_STROKE: 1.5,
    BASE_ICON_SIZE: 20,
    DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
    ElementSize: { Standard: 'standard' },
    DropdownItemType: { PlainText: 'plainText', Divider: 'divider' },
    MenuItemMark: { Check: 'check', Highlight: 'highlight' },
    mergeClasses: (...classes: (string | undefined)[]) =>
      classes.filter(Boolean).join(' '),
    Tooltip: ({ children }: { children: ReactNode }) => children,
    EllipsisTooltip: ({ text }: { text: ReactNode }) => <span>{text}</span>,
    /* Rendered by the navigation lib's UserAvatar / AvatarInitials. */
    AvatarShape: { Circle: 'circle', Square: 'square' },
    Avatar: () => <span aria-hidden="true" />,
    MenuItem: ({
      label,
      icon,
      trailing,
      onClick,
      'aria-current': ariaCurrent,
    }: {
      label: ReactNode;
      icon?: ReactNode;
      trailing?: ReactNode;
      onClick?: () => void;
      'aria-current'?: AriaAttributes['aria-current'];
    }) => (
      <button type="button" aria-current={ariaCurrent} onClick={onClick}>
        {icon}
        {label}
        {trailing}
      </button>
    ),
    Button: ({
      'aria-label': ariaLabel,
      iconBefore,
      onClick,
    }: {
      'aria-label'?: string;
      iconBefore?: ReactNode;
      onClick?: () => void;
    }) => (
      <button type="button" aria-label={ariaLabel} onClick={onClick}>
        {iconBefore}
      </button>
    ),
    IconButton: ({
      'aria-label': ariaLabel,
      'aria-current': ariaCurrent,
    }: {
      'aria-label': string;
      'aria-current'?: AriaAttributes['aria-current'];
    }) => (
      <button type="button" aria-label={ariaLabel} aria-current={ariaCurrent} />
    ),
    GhostIconButton: ({
      'aria-label': ariaLabel,
      onClick,
    }: {
      'aria-label': string;
      onClick?: () => void;
    }) => <button type="button" aria-label={ariaLabel} onClick={onClick} />,
    CloseButton: ({
      ariaLabel,
      onClose,
    }: {
      ariaLabel: string;
      onClose: () => void;
    }) => <button type="button" aria-label={ariaLabel} onClick={onClose} />,
    Dropdown: ({
      children,
      items,
    }: {
      children: ReactNode;
      items: MockDropdownItem[];
    }) => (
      <>
        {children}
        <ul>
          {items.map(({ children: subItems, ...item }) => (
            <li key={item.key}>
              <button type="button" onClick={item.onClick}>
                {item.label}
              </button>
              {subItems && (
                <ul>
                  {subItems.map((child) => (
                    <li key={child.key}>
                      <button type="button" onClick={child.onClick}>
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </>
    ),
  };
});

const isolatedView = vi.hoisted(() => ({ isActive: false }));
vi.mock('../../../context/IsolatedModelViewContext', () => ({
  useIsolatedModelView: () => ({ isActive: isolatedView.isActive }),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentThemeFavicon: undefined }),
}));

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const useUserMock = vi.fn();
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => useUserMock(),
}));

vi.mock('../../SettingsModal/SettingsModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="settings dialog">
      <button onClick={onClose}>close settings</button>
    </div>
  ),
}));

vi.mock('../../FooterMessage/FooterMessage', () => ({
  default: () => <div>Footer message</div>,
}));

vi.mock('../../LogoutConfirmation/LogoutConfirmationModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <p>Log out confirmation</p> : null,
}));

const useUnsavedChangesMock = vi.fn();
vi.mock('../../../context/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => useUnsavedChangesMock(),
}));

vi.mock('../../../server-api/auth.api', () => ({
  logout: vi.fn(),
}));

const authenticatedUser = {
  status: AuthStatus.Authenticated,
  user: {
    sub: 'user-123',
    providerId: 'keycloak',
    claims: { email: 'john.doe@example.com', name: 'John Doe' },
    isAdmin: false,
  },
  refresh: vi.fn(),
  reset: vi.fn(),
};

const setDefaults = (
  mockUseUiFeature: ReturnType<
    typeof vi.mocked<typeof useUiFeatureModule.useUiFeature>
  >,
) => {
  vi.clearAllMocks();
  isolatedView.isActive = false;
  resetSupportedLanguages();
  useAppConfigMock.mockReturnValue({
    status: UserConfigStatus.Ready,
    features: { scheduledTasksEnabled: true },
  });
  useFeatureFlagMock.mockReturnValue(false);
  useUserMock.mockReturnValue(authenticatedUser);
  useUnsavedChangesMock.mockReturnValue({
    hasUnsavedChanges: false,
    requestDiscard: vi.fn(),
  });
  /* Default posture: every route feature on, every `Hide*` opt-out off. */
  mockUseUiFeature.mockImplementation(
    (feature) =>
      feature !== OverlayFeature.HideNewConversation &&
      feature !== OverlayFeature.HideUserMenu &&
      feature !== OverlayFeature.HideUserSettings &&
      feature !== OverlayFeature.HideKeyboardShortcuts &&
      feature !== OverlayFeature.HideNavigationMenu &&
      feature !== OverlayFeature.HideSettingsPage,
  );
};

const sidebarProps = vi.hoisted(
  (): { current: Record<string, unknown> | undefined } => ({
    current: undefined,
  }),
);
const userMenuProps = vi.hoisted(
  (): { current: Record<string, unknown> | undefined } => ({
    current: undefined,
  }),
);

/* The lib sidebar and user menu are replaced by stubs that expose the props the
   app hands them; the libs have their own specs. */
vi.mock('@epam/ai-dial-navigation-panel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-navigation-panel')>();
  return {
    ...actual,
    NavigationSidebar: (props: {
      items: { id: string; label: string; isActive?: boolean }[];
      labels: {
        ariaLabel: string;
        collapse: string;
        expand: string;
        close: string;
      };
      variant: string;
      isOpen?: boolean;
      id?: string;
      isCollapsed: boolean;
      onToggleCollapse?: () => void;
      onClose?: () => void;
      userMenu?: ReactNode;
      footerActions?: ReactNode;
      children?: ReactNode;
    }) => {
      sidebarProps.current = props as unknown as Record<string, unknown>;
      return (
        <nav aria-label={props.labels.ariaLabel}>
          {props.items.map((item) => (
            <a
              key={item.id}
              href={item.id}
              aria-current={item.isActive ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
          {props.onClose && (
            <button onClick={props.onClose}>{props.labels.close}</button>
          )}
          {props.onToggleCollapse && (
            <button onClick={props.onToggleCollapse}>
              {props.isCollapsed ? props.labels.expand : props.labels.collapse}
            </button>
          )}
          <div aria-label="chats slot">{props.children}</div>
          <div aria-label="footer">
            {props.userMenu}
            {props.footerActions}
          </div>
        </nav>
      );
    },
    UserMenu: (props: Record<string, unknown>) => {
      userMenuProps.current = props;
      return <button>user menu</button>;
    },
  };
});

const enableSidebar = (
  mockUseUiFeature: ReturnType<
    typeof vi.mocked<typeof useUiFeatureModule.useUiFeature>
  >,
  disabled: OverlayFeature[] = [],
) => {
  mockUseUiFeature.mockImplementation(
    (feature) =>
      feature !== OverlayFeature.HideUserMenu &&
      feature !== OverlayFeature.HideUserSettings &&
      feature !== OverlayFeature.HideKeyboardShortcuts &&
      feature !== OverlayFeature.HideNavigationMenu &&
      feature !== OverlayFeature.HideSettingsPage &&
      feature !== OverlayFeature.HideNewConversation &&
      !disabled.includes(feature),
  );
};

describe('SidebarNavigation', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => {
    viewport.isMobile = false;
    sidebarProps.current = undefined;
    userMenuProps.current = undefined;
    setDefaults(mockUseUiFeature);
    enableSidebar(mockUseUiFeature);
  });

  it('leaves the operator footer to the chat input on desktop', () => {
    render(
      <MemoryRouter>
        <SidebarNavigation chats={<span>chat list</span>} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Footer message')).toBeNull();
  });

  it('renders the sidebar instead of the rail', () => {
    render(
      <MemoryRouter>
        <SidebarNavigation chats={<span>chat list</span>} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('navigation', { name: NavigationI18nKeys.AriaLabel }),
    ).toBeTruthy();
    expect(screen.getByLabelText('chats slot').textContent).toContain(
      'chat list',
    );
    expect(sidebarProps.current).toBeDefined();
  });

  it('names the root item New chat and keeps it inactive inside a conversation', () => {
    render(
      <MemoryRouter initialEntries={['/conversations/abc']}>
        <SidebarNavigation />
      </MemoryRouter>,
    );

    expect(
      screen
        .getByRole('link', { name: ButtonsI18nKeys.NewChat })
        .hasAttribute('aria-current'),
    ).toBe(false);
  });

  it('forwards the collapsed state and toggles through the app callback', async () => {
    const onToggleCollapse = vi.fn();
    render(
      <MemoryRouter>
        <SidebarNavigation isCollapsed onToggleCollapse={onToggleCollapse} />
      </MemoryRouter>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: NavigationI18nKeys.ExpandSidebar }),
    );

    expect(onToggleCollapse).toHaveBeenCalledOnce();
  });

  it('renders no toggle when conversations-panel-toggle is off', () => {
    enableSidebar(mockUseUiFeature, [OverlayFeature.ConversationsPanelToggle]);
    render(
      <MemoryRouter>
        <SidebarNavigation onToggleCollapse={vi.fn()} />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole('button', {
        name: NavigationI18nKeys.CollapseSidebar,
      }),
    ).toBeNull();
  });

  it('shows the profile trigger expanded and the compact one collapsed', () => {
    const { rerender } = render(
      <MemoryRouter>
        <SidebarNavigation />
      </MemoryRouter>,
    );
    expect(userMenuProps.current?.triggerVariant).toBe(
      UserMenuTriggerVariant.Profile,
    );

    rerender(
      <MemoryRouter>
        <SidebarNavigation isCollapsed />
      </MemoryRouter>,
    );
    expect(userMenuProps.current?.triggerVariant).toBe(
      UserMenuTriggerVariant.Compact,
    );
  });

  it('renders the Usage link to the settings usage tab', () => {
    render(
      <MemoryRouter>
        <SidebarNavigation />
      </MemoryRouter>,
    );

    expect(
      screen
        .getByRole('link', { name: BasicI18nKeys.Usage })
        .getAttribute('href'),
    ).toBe('/usage');
  });

  it('omits the Usage link when the settings page is hidden', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideSettingsPage,
    );
    render(
      <MemoryRouter>
        <SidebarNavigation />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole('link', { name: BasicI18nKeys.Usage }),
    ).toBeNull();
  });

  it('renders no user menu when hide-user-menu is on', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideUserMenu,
    );
    render(
      <MemoryRouter>
        <SidebarNavigation />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'user menu' })).toBeNull();
  });

  it('opens Settings as a dialog instead of navigating', async () => {
    render(
      <MemoryRouter>
        <SidebarNavigation />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole('dialog', { name: 'settings dialog' }),
    ).toBeNull();

    act(() => (userMenuProps.current?.onSettings as () => void)());

    expect(
      await screen.findByRole(
        'dialog',
        { name: 'settings dialog' },
        /* The first open loads the lazy chunk. */
        { timeout: 5000 },
      ),
    ).toBeTruthy();
  });

  it('closes the Settings dialog through its own close', async () => {
    render(
      <MemoryRouter>
        <SidebarNavigation />
      </MemoryRouter>,
    );
    act(() => (userMenuProps.current?.onSettings as () => void)());

    await userEvent.click(
      await screen.findByRole('button', { name: 'close settings' }),
    );

    expect(
      screen.queryByRole('dialog', { name: 'settings dialog' }),
    ).toBeNull();
  });

  describe('items', () => {
    const renderItems = () =>
      render(
        <MemoryRouter>
          <SidebarNavigation />
        </MemoryRouter>,
      );
    const getHrefs = () =>
      screen.getAllByRole('link').map((link) => link.getAttribute('href'));

    it('lists New chat, Scheduled tasks, Catalog and File manager by default', () => {
      renderItems();

      expect(getHrefs()).toEqual(
        expect.arrayContaining(['/', '/scheduled-tasks', '/catalog', '/files']),
      );
    });

    it('hides a feature-flag-gated item when the flag is off', () => {
      useAppConfigMock.mockReturnValue({
        status: UserConfigStatus.Ready,
        features: { scheduledTasksEnabled: false },
      });
      renderItems();

      expect(getHrefs()).not.toContain('/scheduled-tasks');
      expect(getHrefs()).toContain('/catalog');
    });

    it('hides Catalog when catalog is disabled', () => {
      enableSidebar(mockUseUiFeature, [OverlayFeature.Catalog]);
      renderItems();

      expect(getHrefs()).not.toContain('/catalog');
    });

    it('hides File manager when file-manager is disabled', () => {
      enableSidebar(mockUseUiFeature, [OverlayFeature.FileManager]);
      renderItems();

      expect(getHrefs()).not.toContain('/files');
    });

    it('hides New chat when hide-new-conversation is on', () => {
      mockUseUiFeature.mockImplementation(
        (feature) => feature === OverlayFeature.HideNewConversation,
      );
      renderItems();

      expect(getHrefs()).not.toContain('/');
    });
  });

  describe('user menu', () => {
    const renderMenu = () =>
      render(
        <MemoryRouter>
          <SidebarNavigation />
        </MemoryRouter>,
      );

    it('shows the user menu for a signed-in user', () => {
      renderMenu();

      expect(screen.getByRole('button', { name: 'user menu' })).toBeTruthy();
    });

    it('hides the user menu while authentication is still loading', () => {
      useUserMock.mockReturnValue({
        status: AuthStatus.Loading,
        user: null,
        refresh: vi.fn(),
        reset: vi.fn(),
      });
      renderMenu();

      expect(screen.queryByRole('button', { name: 'user menu' })).toBeNull();
    });

    it('offers the language group when several locales ship', () => {
      expect(supportedLanguages.length).toBeGreaterThan(1);
      renderMenu();

      expect(userMenuProps.current?.groups).toHaveLength(1);
    });

    it('drops the language group when only one locale ships', () => {
      supportedLanguages.splice(1);
      renderMenu();

      expect(userMenuProps.current?.groups).toBeUndefined();
    });

    it('drops the language group when hide-user-settings is on', () => {
      mockUseUiFeature.mockImplementation(
        (feature) => feature === OverlayFeature.HideUserSettings,
      );
      renderMenu();

      expect(userMenuProps.current?.groups).toBeUndefined();
    });

    it('offers the Settings entry by default and drops it under hide-settings-page', () => {
      renderMenu();
      expect(userMenuProps.current?.onSettings).toBeTypeOf('function');

      mockUseUiFeature.mockImplementation(
        (feature) => feature === OverlayFeature.HideSettingsPage,
      );
      renderMenu();
      expect(userMenuProps.current?.onSettings).toBeUndefined();
    });
  });
});

describe('SidebarNavigation — mobile drawer', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => {
    viewport.isMobile = true;
    sidebarProps.current = undefined;
    userMenuProps.current = undefined;
    setDefaults(mockUseUiFeature);
    enableSidebar(mockUseUiFeature);
  });

  const renderDrawer = (
    props: Partial<ComponentProps<typeof SidebarNavigation>> = {},
    path = '/',
  ) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <SidebarNavigation
          chats={<span>chat list</span>}
          onClose={vi.fn()}
          {...props}
        />
      </MemoryRouter>,
    );

  it('renders the drawer variant with the chats and the user menu', () => {
    renderDrawer();

    expect(sidebarProps.current?.variant).toBe(NavigationSidebarVariant.Drawer);
    expect(screen.getByLabelText('chats slot').textContent).toContain(
      'chat list',
    );
    expect(screen.getByRole('button', { name: 'user menu' })).toBeTruthy();
  });

  it('carries the operator footer below the chats on every route', () => {
    renderDrawer();

    expect(screen.getByText('Footer message')).toBeTruthy();
  });

  it('closes through the close button', async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose, isOpen: true });

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Close }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('hands the open state and the header toggle target to the sidebar', () => {
    const { rerender } = renderDrawer({ isOpen: false });
    expect(sidebarProps.current?.isOpen).toBe(false);
    expect(sidebarProps.current?.id).toBe(MOBILE_SIDEBAR_ID);

    rerender(
      <MemoryRouter>
        <SidebarNavigation isOpen onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(sidebarProps.current?.isOpen).toBe(true);
  });

  it('closes when the route changes', () => {
    const onClose = vi.fn();
    const Navigator = () => {
      const navigate = useNavigate();
      return (
        <button onClick={() => navigate(ROUTES.Catalog)}>go to catalog</button>
      );
    };
    render(
      <MemoryRouter>
        <Navigator />
        <SidebarNavigation isOpen onClose={onClose} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'go to catalog' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close on the first render', () => {
    const onClose = vi.fn();
    renderDrawer({ onClose, isOpen: true });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers the language and keyboard groups in the drawer menu', () => {
    renderDrawer();

    expect(userMenuProps.current?.groups).toHaveLength(2);
  });

  describe('with hide-navigation-menu', () => {
    beforeEach(() => {
      enableSidebar(mockUseUiFeature);
      mockUseUiFeature.mockImplementation(
        (feature) =>
          feature === OverlayFeature.HideNavigationMenu ||
          feature === OverlayFeature.ConversationsSection ||
          feature === OverlayFeature.ConversationsPanelToggle,
      );
    });

    it('keeps the chats but drops the items, the user menu and the Usage link', () => {
      renderDrawer({ isOpen: true });

      expect(screen.getByLabelText('chats slot').textContent).toContain(
        'chat list',
      );
      expect(sidebarProps.current?.items).toEqual([]);
      expect(screen.queryByRole('button', { name: 'user menu' })).toBeNull();
      expect(
        screen.queryByRole('link', { name: BasicI18nKeys.Usage }),
      ).toBeNull();
    });
  });
});

describe('SidebarNavigation — log out', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);
  const replaceSpy = vi.fn();
  const requestDiscard = vi.fn();

  beforeEach(() => {
    viewport.isMobile = false;
    userMenuProps.current = undefined;
    setDefaults(mockUseUiFeature);
    enableSidebar(mockUseUiFeature);
    vi.mocked(logout).mockResolvedValue(undefined);
    vi.stubGlobal('location', { ...window.location, replace: replaceSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const markDirty = () =>
    useUnsavedChangesMock.mockReturnValue({
      hasUnsavedChanges: true,
      requestDiscard,
    });

  const renderAndLogOut = () => {
    render(
      <MemoryRouter>
        <SidebarNavigation />
      </MemoryRouter>,
    );
    act(() => (userMenuProps.current?.onLogout as () => void)());
  };

  it('opens the log out confirmation when no builder is dirty', () => {
    renderAndLogOut();

    expect(screen.getByText('Log out confirmation')).toBeTruthy();
    expect(requestDiscard).not.toHaveBeenCalled();
  });

  it('asks about unsaved changes instead of opening the confirmation while a builder is dirty', () => {
    markDirty();

    renderAndLogOut();

    expect(requestDiscard).toHaveBeenCalledOnce();
    expect(screen.queryByText('Log out confirmation')).toBeNull();
  });

  it('does not log out when the unsaved-changes dialog is kept', () => {
    markDirty();

    renderAndLogOut();

    /* Keep editing never runs the deferred callback. */
    expect(logout).not.toHaveBeenCalled();
  });

  it('logs out once without the confirmation when changes are discarded', async () => {
    markDirty();
    renderAndLogOut();
    const [onDiscard] = requestDiscard.mock.calls[0] as [() => Promise<void>];

    await act(() => onDiscard());

    expect(logout).toHaveBeenCalledOnce();
    expect(replaceSpy).toHaveBeenCalledOnce();
    expect(screen.queryByText('Log out confirmation')).toBeNull();
  });
});

describe('SidebarNavigation — isolated model view', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => {
    viewport.isMobile = false;
    userMenuProps.current = undefined;
    sidebarProps.current = undefined;
    setDefaults(mockUseUiFeature);
    enableSidebar(mockUseUiFeature);
    isolatedView.isActive = true;
  });

  it('keeps the chats and drops the items, the user menu and the Usage link on desktop', () => {
    render(
      <MemoryRouter>
        <SidebarNavigation chats={<span>chat list</span>} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('chats slot').textContent).toContain(
      'chat list',
    );
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'user menu' })).toBeNull();
  });
});
