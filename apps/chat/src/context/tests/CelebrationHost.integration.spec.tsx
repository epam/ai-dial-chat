import {
  CELEBRATIONS_CLASS,
  CelebrationDecor,
  useCelebration,
} from '@epam/ai-dial-celebrations';
import { HalloweenScene } from '@epam/ai-dial-celebrations/halloween';
import { replaceCelebrationScenes } from '@epam/ai-dial-celebrations/packs';
import type { CelebrationDeliveryDto } from '@epam/ai-dial-chat-api-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { Link, MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANIMATION_DATA,
  BUNDLED_DELIVERY,
  CATALOG,
  CONFETTI_POSTER_ID,
  COURIERS_DELIVERY,
  COURIERS_POSTER_ID,
  PILOT_DELIVERY,
  SNOWMAN_POSTER_ID,
  anniversaryPack,
  newYearPack,
} from '../../hooks/celebration/tests/celebration-pack-fixtures';
import {
  getCelebrationCatalog,
  getCelebrationPack,
  loadCelebrationAssetJson,
} from '../../server-api/celebrations.api';
import { StorageKey } from '../../types/storage-key';
import { UserConfigStatus } from '../../types/user-config-status';
import { useAppConfig } from '../AppConfigContext';
import { CelebrationHost } from '../CelebrationHost';
import { useNotification } from '../NotificationContext';
import { useTheme } from '../ThemeContext';

const { host } = vi.hoisted(() => ({
  host: { isMobile: false, language: 'en' },
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useIsMobile: () => host.isMobile,
}));
vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));
vi.mock('../NotificationContext', () => ({ useNotification: vi.fn() }));
vi.mock('../ThemeContext', () => ({ useTheme: vi.fn() }));
/* The BFF is out of scope here; the adapter's own spec covers the transport. */
vi.mock('../../server-api/celebrations.api', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../server-api/celebrations.api')
  >()),
  getCelebrationCatalog: vi.fn(),
  getCelebrationPack: vi.fn(),
  loadCelebrationAssetJson: vi.fn(),
}));
/* Spied only so a test can wait until the composed New Year event exists. */
vi.mock('@epam/ai-dial-celebrations/packs', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-celebrations/packs')>();
  return {
    ...actual,
    replaceCelebrationScenes: vi.fn(actual.replaceCelebrationScenes),
  };
});

/* This suite checks host event and notification wiring. The celebrations suite
   and browser checks cover playback; avoid Lottie's canvas helpers in JSDOM. */
vi.mock('lottie-web/build/player/lottie_light', () => ({
  default: {
    loadAnimation: () => {
      throw new Error('Animation renderer unavailable in host integration');
    },
  },
}));

/* Key-as-output, but a toast message keeps the interpolated `phrase`, as real
   i18next does, so the library's secret-hint substitution stays visible. */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key.endsWith('ToastMessage') && params?.phrase
        ? `${key} ${params.phrase}`
        : key,
    i18n: {
      language: host.language,
      resolvedLanguage: host.language,
      dir: (language: string) => (language === 'ar' ? 'rtl' : 'ltr'),
      changeLanguage: vi.fn(),
    },
  }),
}));

const showSuccessNotification = vi.fn();
let lastConsumeResult: boolean | null = null;

/* The scene layer is decorative and aria-hidden, so no role query reaches it. */
const querySceneLayer = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.body.querySelector(`.${CELEBRATIONS_CLASS.sceneLayer}`);

const Triggers: FC = () => {
  const { isEnabled, celebrate, consumeSecretPhrase } = useCelebration();
  return (
    <>
      <Link to="/conversations/existing">open conversation</Link>
      <Link to="/">back to start</Link>
      <span data-testid="enabled">{String(isEnabled)}</span>
      <button type="button" onClick={() => celebrate(HalloweenScene.Ghost)}>
        wake the ghosts
      </button>
      <button
        type="button"
        onClick={() => {
          lastConsumeResult = consumeSecretPhrase('Trick or treat!');
        }}
      >
        say phrase
      </button>
    </>
  );
};

const setActiveEvent = (
  activeEventId: string | null,
  celebrationDelivery: CelebrationDeliveryDto = BUNDLED_DELIVERY,
) => {
  vi.mocked(useAppConfig).mockReturnValue({
    status: UserConfigStatus.Ready,
    features: {},
    config: {
      activeEventId,
      celebrationsEnabledByDefault: true,
      celebrationDelivery,
    },
  } as ReturnType<typeof useAppConfig>);
};

const setTheme = (currentTheme: string) => {
  vi.mocked(useTheme).mockReturnValue({
    currentTheme,
  } as ReturnType<typeof useTheme>);
};

/* The poster of a pack scene, served from the app-built asset URL. */
const queryPackPoster = (assetId: string) =>
  // eslint-disable-next-line testing-library/no-node-access
  querySceneLayer()?.querySelector<HTMLImageElement>(
    `img[src="/api/v1/celebrations/assets/${assetId}"]`,
  ) ?? null;

const NewYearTriggers: FC = () => {
  const { consumeSecretPhrase } = useCelebration();
  return (
    <>
      <CelebrationDecor />
      <button
        type="button"
        onClick={() => consumeSecretPhrase('happy new year')}
      >
        say phrase
      </button>
    </>
  );
};

/* A fresh element per call: React skips re-rendering an identical one. */
const newYearTree = () => (
  <MemoryRouter>
    <CelebrationHost>
      <NewYearTriggers />
    </CelebrationHost>
  </MemoryRouter>
);

/* Waits until the pack has resolved and the provider has reloaded New Year
   with the external snowman, then returns the gift trigger. */
const renderPilotNewYear = async (delivery = PILOT_DELIVERY) => {
  setActiveEvent('new-year', delivery);
  const view = render(newYearTree());
  await waitFor(() => expect(replaceCelebrationScenes).toHaveBeenCalled(), {
    timeout: 5000,
  });
  const gift = await screen.findByRole(
    'button',
    { name: 'newYear.giftLabel' },
    { timeout: 5000 },
  );
  return { ...view, gift };
};

const renderHost = async (path = '/') => {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <CelebrationHost>
        <Triggers />
      </CelebrationHost>
    </MemoryRouter>,
  );
  if (path === '/') {
    await waitFor(() =>
      expect(screen.getByTestId('enabled').textContent).toBe('true'),
    );
  }
  return view;
};

describe('CelebrationHost with the celebrations library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    host.isMobile = false;
    host.language = 'en';
    setTheme('light');
    vi.mocked(getCelebrationCatalog).mockResolvedValue(CATALOG);
    vi.mocked(getCelebrationPack).mockImplementation(async (packId) =>
      packId === 'company-anniversary' ? anniversaryPack() : newYearPack(),
    );
    vi.mocked(loadCelebrationAssetJson).mockResolvedValue(ANIMATION_DATA);
    localStorage.setItem(StorageKey.CelebrationsEnabled, 'true');
    lastConsumeResult = null;
    setActiveEvent('halloween');
    vi.mocked(useNotification).mockReturnValue({
      showSuccessNotification,
    } as unknown as ReturnType<typeof useNotification>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it.each(['/conversations/existing', '/apps-editor', '/catalog'])(
    'does not intercept messages or celebrate on %s',
    async (path) => {
      await renderHost(path);
      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));
      await userEvent.click(
        screen.getByRole('button', { name: 'wake the ghosts' }),
      );
      expect(screen.getByTestId('enabled').textContent).toBe('false');
      expect(lastConsumeResult).toBe(false);
      expect(showSuccessNotification).not.toHaveBeenCalled();
      expect(querySceneLayer()).toBeNull();
    },
  );

  it('announces a scene through the success toast with translated text and the secret hint', async () => {
    await renderHost();
    await userEvent.click(
      screen.getByRole('button', { name: 'wake the ghosts' }),
    );
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: 'halloween.toastTitle',
      message: 'halloween.ghostToastMessage trick or treat',
    });
    expect(querySceneLayer()).not.toBeNull();
  });

  it('consumes the secret phrase on the start page', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await renderHost();
    await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));
    expect(lastConsumeResult).toBe(true);
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: 'halloween.toastTitle',
      message: 'halloween.spidersToastMessage trick or treat',
    });
  });

  it('removes an active scene on navigation and does not resume it on return', async () => {
    await renderHost();
    await userEvent.click(
      screen.getByRole('button', { name: 'wake the ghosts' }),
    );
    expect(querySceneLayer()).not.toBeNull();
    await userEvent.click(
      screen.getByRole('link', { name: 'open conversation' }),
    );
    expect(querySceneLayer()).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'back to start' }));
    await waitFor(() =>
      expect(screen.getByTestId('enabled').textContent).toBe('true'),
    );
    expect(querySceneLayer()).toBeNull();
  });

  it.each([
    [0, 'newYear.penguinStarToastMessage happy new year'],
    [0.99, 'newYear.snowmanDeliveryToastMessage happy new year'],
  ])(
    'loads New Year through the same decor slot with its translated trigger (random %s)',
    async (roll, message) => {
      vi.spyOn(Math, 'random').mockReturnValue(roll);
      setActiveEvent('new-year');
      render(
        <MemoryRouter>
          <CelebrationHost>
            <CelebrationDecor />
          </CelebrationHost>
        </MemoryRouter>,
      );
      /* The New Year scene is a lazy chunk; its cold import can outlast the
       default 1s findBy window when the whole suite runs in parallel. */
      const gift = await screen.findByRole(
        'button',
        { name: 'newYear.giftLabel' },
        { timeout: 5000 },
      );
      await userEvent.click(gift);
      expect(showSuccessNotification).toHaveBeenLastCalledWith({
        title: 'newYear.toastTitle',
        message,
      });
    },
  );

  it('keeps the default policy free of celebration requests', async () => {
    await renderHost();

    expect(getCelebrationCatalog).not.toHaveBeenCalled();
  });

  describe('with external packs', () => {
    it('plays the allowlisted snowman from its pack with the bundled notification', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { gift } = await renderPilotNewYear();

      await userEvent.click(gift);

      expect(showSuccessNotification).toHaveBeenLastCalledWith({
        title: 'newYear.toastTitle',
        message: 'newYear.snowmanDeliveryToastMessage happy new year',
      });
      /* The mocked player fails before playback, so the pack poster shows. */
      await waitFor(() =>
        expect(queryPackPoster(SNOWMAN_POSTER_ID)).toBeTruthy(),
      );
    });

    it('plays the operator-added couriers with the pack toast', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const { gift } = await renderPilotNewYear();

      await userEvent.click(gift);

      expect(showSuccessNotification).toHaveBeenLastCalledWith({
        title: 'newYear.toastTitle',
        message: 'Two couriers, one gingerbread star.',
      });
      await waitFor(() =>
        expect(queryPackPoster(COURIERS_POSTER_ID)).toBeTruthy(),
      );
    });

    it('keeps the bundled snowman when only the couriers are added', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { gift } = await renderPilotNewYear(COURIERS_DELIVERY);

      await userEvent.click(gift);

      expect(showSuccessNotification).toHaveBeenLastCalledWith({
        title: 'newYear.toastTitle',
        message: 'newYear.snowmanDeliveryToastMessage happy new year',
      });
      expect(querySceneLayer()).toBeTruthy();
      expect(queryPackPoster(SNOWMAN_POSTER_ID)).toBeNull();
    });

    it('keeps penguin-star bundled on a click', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const { gift } = await renderPilotNewYear();

      await userEvent.click(gift);

      expect(showSuccessNotification).toHaveBeenLastCalledWith({
        title: 'newYear.toastTitle',
        message: 'newYear.penguinStarToastMessage happy new year',
      });
      expect(querySceneLayer()).toBeTruthy();
      expect(queryPackPoster(SNOWMAN_POSTER_ID)).toBeNull();
    });

    it('keeps the secret phrase on the bundled gift-wrapping', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await renderPilotNewYear();

      await userEvent.click(screen.getByRole('button', { name: 'say phrase' }));

      expect(showSuccessNotification).toHaveBeenLastCalledWith({
        title: 'newYear.toastTitle',
        message: 'newYear.giftWrappingToastMessage happy new year',
      });
      expect(queryPackPoster(SNOWMAN_POSTER_ID)).toBeNull();
    });

    it('mirrors the external snowman under dir="rtl"', async () => {
      host.language = 'ar';
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { gift } = await renderPilotNewYear();

      await userEvent.click(gift);

      await waitFor(() =>
        expect(queryPackPoster(SNOWMAN_POSTER_ID)).toBeTruthy(),
      );
      const poster = queryPackPoster(SNOWMAN_POSTER_ID);
      expect(poster?.className).toMatch(/mirrored/);
      // eslint-disable-next-line testing-library/no-node-access
      expect(poster?.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
    });

    it.each([
      ['the theme', () => setTheme('dark')],
      ['the direction', () => (host.language = 'ar')],
      ['the layout', () => (host.isMobile = true)],
    ])('cancels the playing scene when %s changes', async (_name, change) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { gift, rerender } = await renderPilotNewYear();
      await userEvent.click(gift);
      await waitFor(() =>
        expect(queryPackPoster(SNOWMAN_POSTER_ID)).toBeTruthy(),
      );

      change();
      rerender(newYearTree());

      expect(querySceneLayer()).toBeNull();
    });

    it('keeps the playing scene when only the language changes', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { gift, rerender } = await renderPilotNewYear();
      await userEvent.click(gift);
      await waitFor(() =>
        expect(queryPackPoster(SNOWMAN_POSTER_ID)).toBeTruthy(),
      );

      host.language = 'de';
      rerender(newYearTree());

      expect(queryPackPoster(SNOWMAN_POSTER_ID)).toBeTruthy();
    });

    it.each(['ltr', 'rtl'])(
      'plays the company-anniversary event from its keyboard-reachable trigger (%s)',
      async (dir) => {
        host.language = dir === 'rtl' ? 'ar' : 'en';
        setActiveEvent('company-anniversary', PILOT_DELIVERY);
        render(
          <MemoryRouter>
            <CelebrationHost>
              <CelebrationDecor />
            </CelebrationHost>
          </MemoryRouter>,
        );
        const trigger = await screen.findByRole(
          'button',
          { name: 'Celebrate the anniversary' },
          { timeout: 5000 },
        );

        trigger.focus();
        await userEvent.keyboard('{Enter}');

        expect(showSuccessNotification).toHaveBeenLastCalledWith({
          title: 'Happy anniversary',
          message: 'Confetti for everyone',
        });
        await waitFor(() =>
          expect(queryPackPoster(CONFETTI_POSTER_ID)).toBeTruthy(),
        );
      },
    );

    it('hides an admitted external-only event while the catalog is unavailable', async () => {
      vi.mocked(getCelebrationCatalog).mockRejectedValue(
        new Error('Service unavailable'),
      );
      setActiveEvent('company-anniversary', PILOT_DELIVERY);
      render(
        <MemoryRouter>
          <CelebrationHost>
            <CelebrationDecor />
          </CelebrationHost>
        </MemoryRouter>,
      );
      await waitFor(() => expect(getCelebrationCatalog).toHaveBeenCalled());

      expect(
        screen.queryByRole('button', { name: 'Celebrate the anniversary' }),
      ).toBeNull();
    });
  });
});
