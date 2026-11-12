import type { CelebrationProviderProps } from '@epam/ai-dial-celebrations';
import { HALLOWEEN_LABELS } from '@epam/ai-dial-celebrations/halloween';
import { NEW_YEAR_LABELS } from '@epam/ai-dial-celebrations/new-year';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HalloweenI18nKeys,
  NewYearI18nKeys,
} from '../../constants/translation-keys';
import {
  BUNDLED_DELIVERY,
  CATALOG,
  PILOT_DELIVERY,
  newYearPack,
} from '../../hooks/celebration/tests/celebration-pack-fixtures';
import { useCelebrationPreference } from '../../hooks/celebration/useCelebrationPreference';
import en from '../../i18n/locales/en.json';
import {
  getCelebrationCatalog,
  getCelebrationPack,
} from '../../server-api/celebrations.api';
import { StorageKey } from '../../types/storage-key';
import { UserConfigStatus } from '../../types/user-config-status';
import { useAppConfig } from '../AppConfigContext';
import { CelebrationHost } from '../CelebrationHost';
import { useNotification } from '../NotificationContext';
import { useTheme } from '../ThemeContext';

const { receivedProps, host } = vi.hoisted(() => ({
  receivedProps: [] as CelebrationProviderProps[],
  host: { isMobile: true, language: 'en' },
}));

/* Records what the adapter resolves; the library has its own runtime tests. */
vi.mock('@epam/ai-dial-celebrations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-celebrations')>()),
  CelebrationProvider: (props: CelebrationProviderProps) => {
    receivedProps.push(props);
    return props.children;
  },
}));
vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));
vi.mock('../NotificationContext', () => ({ useNotification: vi.fn() }));
vi.mock('../ThemeContext', () => ({ useTheme: vi.fn() }));
vi.mock('../../server-api/celebrations.api', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../server-api/celebrations.api')
  >()),
  getCelebrationCatalog: vi.fn(),
  getCelebrationPack: vi.fn(),
}));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useIsMobile: () => host.isMobile,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.phrase ? `${key}|${params.phrase}` : key,
    i18n: {
      language: host.language,
      resolvedLanguage: host.language,
      dir: (language: string) => (language === 'ar' ? 'rtl' : 'ltr'),
    },
  }),
}));

const showSuccessNotification = vi.fn();
const lastProps = () => receivedProps[receivedProps.length - 1];

const setConfig = (
  activeEventId: string | null,
  status = UserConfigStatus.Ready,
  celebrationsEnabledByDefault = true,
  celebrationDelivery = BUNDLED_DELIVERY,
) => {
  vi.mocked(useAppConfig).mockReturnValue({
    status,
    features: {},
    config: {
      activeEventId,
      celebrationsEnabledByDefault,
      celebrationDelivery,
    },
  } as ReturnType<typeof useAppConfig>);
};

const setTheme = (currentTheme: string) => {
  vi.mocked(useTheme).mockReturnValue({
    currentTheme,
  } as ReturnType<typeof useTheme>);
};

const hostTree = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <CelebrationHost>
      <Link to="/conversations/existing">open conversation</Link>
      <Link to="/">back to start</Link>
    </CelebrationHost>
  </MemoryRouter>
);

const renderHost = (path = '/') => render(hostTree(path));

describe('CelebrationHost', () => {
  beforeEach(() => {
    receivedProps.length = 0;
    vi.clearAllMocks();
    host.isMobile = true;
    host.language = 'en';
    setTheme('light');
    vi.mocked(getCelebrationCatalog).mockResolvedValue(CATALOG);
    vi.mocked(getCelebrationPack).mockResolvedValue(newYearPack());
    localStorage.setItem(StorageKey.CelebrationsEnabled, 'true');
    setConfig('halloween');
    vi.mocked(useNotification).mockReturnValue({
      showSuccessNotification,
    } as unknown as ReturnType<typeof useNotification>);
  });

  it('passes the configured event only on the start page once config is ready', () => {
    renderHost();

    expect(lastProps().activeEventId).toBe('halloween');
    expect(lastProps().isMobile).toBe(true);
    expect(Object.keys(lastProps().events)).toEqual(['halloween', 'new-year']);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('passes the event to a user who never chose while the operator default is on', () => {
    localStorage.clear();
    renderHost();

    expect(lastProps().activeEventId).toBe('halloween');
  });

  it('withholds the event from a user who turned celebrations off', () => {
    localStorage.setItem(StorageKey.CelebrationsEnabled, 'false');
    renderHost();

    expect(lastProps().activeEventId).toBeNull();
  });

  it('withholds the event until the user turns celebrations on when the operator default is off', () => {
    localStorage.clear();
    setConfig('halloween', UserConfigStatus.Ready, false);
    renderHost();

    expect(lastProps().activeEventId).toBeNull();

    const { result } = renderHook(() => useCelebrationPreference());
    act(() => result.current.setIsEnabled(true));

    expect(lastProps().activeEventId).toBe('halloween');
  });

  it.each([
    UserConfigStatus.Idle,
    UserConfigStatus.Loading,
    UserConfigStatus.Error,
  ])('withholds the event while config is %s', (status) => {
    setConfig('halloween', status);
    renderHost();

    expect(lastProps().activeEventId).toBeNull();
  });

  it.each(['/conversations/existing', '/catalog', '/apps-editor'])(
    'withholds the event on %s',
    (path) => {
      renderHost(path);

      expect(lastProps().activeEventId).toBeNull();
    },
  );

  it('changes the reset key on every navigation', async () => {
    renderHost();
    const initialKey = lastProps().resetKey;

    await userEvent.click(
      screen.getByRole('link', { name: 'open conversation' }),
    );
    expect(lastProps().activeEventId).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'back to start' }));

    expect(lastProps().activeEventId).toBe('halloween');
    expect(lastProps().resetKey).not.toBe(initialKey);
  });

  it('maps every existing Halloween and New Year key onto a label, keeping the phrase placeholder', () => {
    renderHost();
    const { labels } = lastProps();

    expect(Object.keys(labels?.halloween ?? {})).toHaveLength(
      Object.values(HalloweenI18nKeys).length,
    );
    expect(Object.keys(labels?.['new-year'] ?? {})).toHaveLength(
      Object.values(NewYearI18nKeys).length,
    );
    expect(labels?.halloween.ghostToastMessage).toBe(
      `${HalloweenI18nKeys.GhostToastMessage}|{{phrase}}`,
    );
    expect(labels?.['new-year'].giftLabel).toBe(
      `${NewYearI18nKeys.GiftLabel}|{{phrase}}`,
    );
  });

  it('maps every library label from an existing key, and the library defaults match en.json', () => {
    renderHost();
    const { labels } = lastProps();

    expect(Object.keys(labels?.halloween ?? {}).sort()).toEqual(
      Object.keys(HALLOWEEN_LABELS).sort(),
    );
    expect(Object.keys(labels?.['new-year'] ?? {}).sort()).toEqual(
      Object.keys(NEW_YEAR_LABELS).sort(),
    );
    expect(HALLOWEEN_LABELS).toEqual(en.halloween);
    expect(NEW_YEAR_LABELS).toEqual(en.newYear);
  });

  it('forwards scene notifications to the success toast', () => {
    renderHost();

    lastProps().onNotify?.({ title: 'Boo', message: 'Say the phrase' });

    expect(showSuccessNotification).toHaveBeenCalledWith({
      title: 'Boo',
      message: 'Say the phrase',
    });
  });

  it('hands the library host anchors instead of routes and class imports', () => {
    renderHost();

    expect(lastProps().anchors).toMatchObject({
      composer: 'dial-ci-wrapper',
      starterList: 'dial-starter-buttons-list',
      historyContainer: 'celebration-history',
      historyRowLink: 'a[href^="/conversations/"]',
    });
  });

  describe('delivery policy', () => {
    it('passes the compiled loaders and requests no pack under the default policy', () => {
      setConfig('new-year');
      renderHost();

      expect(Object.keys(lastProps().events)).toEqual([
        'halloween',
        'new-year',
      ]);
      expect(getCelebrationCatalog).not.toHaveBeenCalled();
      expect(getCelebrationPack).not.toHaveBeenCalled();
    });

    it('requests nothing for UI_EVENT=none even with an allowlisted scene', () => {
      setConfig(null, UserConfigStatus.Ready, true, PILOT_DELIVERY);
      renderHost();

      expect(lastProps().activeEventId).toBeNull();
      expect(getCelebrationCatalog).not.toHaveBeenCalled();
    });

    it('changes the reset key once the allowlisted pack resolves, and keeps bundled labels over pack labels', async () => {
      setConfig('new-year', UserConfigStatus.Ready, true, PILOT_DELIVERY);
      renderHost();
      const pendingKey = lastProps().resetKey;
      const pendingLoader = lastProps().events['new-year'];

      await waitFor(() => expect(lastProps().resetKey).not.toBe(pendingKey));

      expect(lastProps().events['new-year']).not.toBe(pendingLoader);
      expect(lastProps().labels?.['new-year'].snowmanDeliveryToastMessage).toBe(
        `${NewYearI18nKeys.SnowmanDeliveryToastMessage}|{{phrase}}`,
      );
    });

    it('changes the reset key when the policy revision changes', () => {
      setConfig('new-year');
      const { rerender } = renderHost();
      const initialKey = lastProps().resetKey;

      setConfig('new-year', UserConfigStatus.Ready, true, {
        ...BUNDLED_DELIVERY,
        revision: '1',
      });
      rerender(hostTree('/'));

      expect(lastProps().resetKey).not.toBe(initialKey);
    });
  });

  describe('cancellation identity', () => {
    it.each([
      ['the theme', () => setTheme('dark')],
      ['the direction', () => (host.language = 'ar')],
      ['the layout', () => (host.isMobile = false)],
    ])('changes the reset key when %s changes', (_name, change) => {
      const { rerender } = renderHost();
      const initialKey = lastProps().resetKey;

      change();
      rerender(hostTree('/'));

      expect(lastProps().resetKey).not.toBe(initialKey);
    });

    it('keeps the reset key when only the language changes', () => {
      const { rerender } = renderHost();
      const initialKey = lastProps().resetKey;

      host.language = 'de';
      rerender(hostTree('/'));

      expect(lastProps().resetKey).toBe(initialKey);
    });
  });
});
