import type { CelebrationProviderProps } from '@epam/ai-dial-celebrations';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HalloweenI18nKeys,
  NewYearI18nKeys,
} from '../../constants/translation-keys';
import { UserConfigStatus } from '../../types/user-config-status';
import { useAppConfig } from '../AppConfigContext';
import { CelebrationHost } from '../CelebrationHost';
import { useNotification } from '../NotificationContext';

const { receivedProps } = vi.hoisted(() => ({
  receivedProps: [] as CelebrationProviderProps[],
}));

/* Records what the adapter resolves; the library has its own runtime tests. */
vi.mock('@epam/ai-dial-celebrations', () => ({
  CelebrationProvider: (props: CelebrationProviderProps) => {
    receivedProps.push(props);
    return props.children;
  },
}));
vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));
vi.mock('../NotificationContext', () => ({ useNotification: vi.fn() }));
vi.mock('../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => true,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.phrase ? `${key}|${params.phrase}` : key,
    i18n: { language: 'en' },
  }),
}));

const showSuccessNotification = vi.fn();
const lastProps = () => receivedProps[receivedProps.length - 1];

const setConfig = (
  activeEventId: string | null,
  status = UserConfigStatus.Ready,
) => {
  vi.mocked(useAppConfig).mockReturnValue({
    status,
    features: {},
    config: { activeEventId },
  } as ReturnType<typeof useAppConfig>);
};

const renderHost = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CelebrationHost>
        <Link to="/conversations/existing">open conversation</Link>
        <Link to="/">back to start</Link>
      </CelebrationHost>
    </MemoryRouter>,
  );

describe('CelebrationHost', () => {
  beforeEach(() => {
    receivedProps.length = 0;
    vi.clearAllMocks();
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
});
