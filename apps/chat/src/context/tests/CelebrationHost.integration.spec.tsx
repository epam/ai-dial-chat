import {
  CELEBRATIONS_CLASS,
  CelebrationDecor,
  useCelebration,
} from '@epam/ai-dial-celebrations';
import { HalloweenScene } from '@epam/ai-dial-celebrations/halloween';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { Link, MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserConfigStatus } from '../../types/user-config-status';
import { useAppConfig } from '../AppConfigContext';
import { CelebrationHost } from '../CelebrationHost';
import { useNotification } from '../NotificationContext';

vi.mock('../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));
vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));
vi.mock('../NotificationContext', () => ({ useNotification: vi.fn() }));

/* Key-as-output, but a toast message keeps the interpolated `phrase`, as real
   i18next does, so the library's secret-hint substitution stays visible. */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key.endsWith('ToastMessage') && params?.phrase
        ? `${key} ${params.phrase}`
        : key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
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

const setActiveEvent = (activeEventId: string | null) => {
  vi.mocked(useAppConfig).mockReturnValue({
    status: UserConfigStatus.Ready,
    features: {},
    config: { activeEventId },
  } as ReturnType<typeof useAppConfig>);
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
    lastConsumeResult = null;
    setActiveEvent('halloween');
    vi.mocked(useNotification).mockReturnValue({
      showSuccessNotification,
    } as unknown as ReturnType<typeof useNotification>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('loads New Year through the same decor slot with its translated trigger', async () => {
    setActiveEvent('new-year');
    render(
      <MemoryRouter>
        <CelebrationHost>
          <CelebrationDecor />
        </CelebrationHost>
      </MemoryRouter>,
    );
    const gift = await screen.findByRole('button', {
      name: 'newYear.giftLabel',
    });
    await userEvent.click(gift);
    expect(showSuccessNotification).toHaveBeenLastCalledWith({
      title: 'newYear.toastTitle',
      message: expect.stringMatching(
        /^newYear\.(snow|confetti|sleigh)ToastMessage happy new year$/,
      ),
    });
  });
});
