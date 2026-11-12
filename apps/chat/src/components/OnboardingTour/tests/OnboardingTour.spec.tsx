import type { OnboardingHintDto } from '@epam/ai-dial-chat-api-client';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppConfig as mockUseAppConfig } from '../../../context/tests/app-config-context-mock';
import { StorageKey } from '../../../types/storage-key';
import { UserConfigStatus } from '../../../types/user-config-status';
import OnboardingTour, {
  ONBOARDING_RETRY_INTERVAL_MS,
  ONBOARDING_START_DELAY_MS,
} from '../OnboardingTour';

const { state } = vi.hoisted(() => ({
  state: {
    status: 'ready' as UserConfigStatus,
    hints: [] as OnboardingHintDto[],
    isMobile: false,
  },
}));

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
mockUseAppConfig.mockImplementation(() => ({
  status: state.status,
  config: { onboardingHints: state.hints },
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useIsMobile: () => state.isMobile,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${options.current}/${options.total}` : key,
    i18n: { dir: () => 'ltr' },
  }),
}));

const hint = (
  id: string,
  target: OnboardingHintDto['target'],
  title: string,
): OnboardingHintDto => ({ id, target, title, description: `${title} body` });

/* A catalog that, like the real one, renders its controls only once its
 * data has loaded. */
const CATALOG_LOAD_MS = 2000;
const CatalogPage = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), CATALOG_LOAD_MS);
    return () => clearTimeout(timer);
  }, []);
  return isLoaded ? (
    <section aria-label="navigation.catalog">
      <button type="button">buttons.create</button>
    </section>
  ) : (
    <p>Loading</p>
  );
};

/* The page the tour runs over: a New chat button, the composer on the root
 * route and a catalog route. There is no navigation landmark, so a
 * `navigation` hint has nothing to point at. */
const startTour = async (initialPath = '/') => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <button aria-label="buttons.newChat">+</button>
      <Link to="/catalog">Go to catalog</Link>
      <main id="main-content">
        <Routes>
          <Route path="/" element={<textarea aria-label="Message" />} />
          <Route path="/catalog" element={<CatalogPage />} />
        </Routes>
      </main>
      <OnboardingTour />
    </MemoryRouter>,
  );
  await act(async () => {
    vi.advanceTimersByTime(ONBOARDING_START_DELAY_MS);
  });
};

/* Two steps, because React commits the catalog's loaded state only when an
 * act() ends: the tour's next retry has to come after that commit. */
const waitForCatalogThenRetry = async () => {
  await act(async () => {
    vi.advanceTimersByTime(CATALOG_LOAD_MS);
  });
  await act(async () => {
    vi.advanceTimersByTime(ONBOARDING_RETRY_INTERVAL_MS);
  });
};

const readSeen = (): string[] =>
  JSON.parse(localStorage.getItem(StorageKey.SeenOnboardingHints) ?? '[]');

describe('OnboardingTour', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
    state.status = UserConfigStatus.Ready;
    state.isMobile = false;
    state.hints = [
      hint('new-chat', 'new-chat', 'Start a chat'),
      hint('composer', 'conversation-input', 'Ask here'),
    ];
    /* jsdom lays nothing out; give every element a box the resolver accepts. */
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
      { top: 0, left: 0, width: 10, height: 10 },
    ] as unknown as DOMRectList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('walks through the hints and remembers them once done', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await startTour();

    const dialog = screen.getByRole('dialog', { name: 'Start a chat' });
    expect(dialog.textContent).toContain('onboardingTour.stepCounter:1/2');
    // eslint-disable-next-line testing-library/no-node-access -- focus placement has no query; the focused element is the assertion
    expect(document.activeElement).toBe(dialog);

    await user.click(
      screen.getByRole('button', { name: 'onboardingTour.next' }),
    );
    expect(screen.getByRole('dialog', { name: 'Ask here' })).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: 'onboardingTour.done' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readSeen()).toEqual(['new-chat', 'composer']);
  });

  it('goes back a step', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await startTour();

    await user.click(
      screen.getByRole('button', { name: 'onboardingTour.next' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'onboardingTour.back' }),
    );
    expect(screen.getByRole('dialog', { name: 'Start a chat' })).toBeTruthy();
  });

  it('marks the shown hints seen when skipped with Escape', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await startTour();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readSeen()).toEqual(['new-chat', 'composer']);
  });

  it('skips a hint whose element is not on screen', async () => {
    state.hints = [
      hint('nav', 'navigation', 'Your sidebar'),
      hint('composer', 'conversation-input', 'Ask here'),
    ];
    await startTour();

    const dialog = screen.getByRole('dialog', { name: 'Ask here' });
    expect(dialog.textContent).toContain('onboardingTour.stepCounter:1/1');
  });

  it('does not show hints the user has already seen', async () => {
    localStorage.setItem(
      StorageKey.SeenOnboardingHints,
      JSON.stringify(['new-chat', 'composer']),
    );
    await startTour();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows only a newly added hint to a returning user', async () => {
    localStorage.setItem(
      StorageKey.SeenOnboardingHints,
      JSON.stringify(['new-chat']),
    );
    await startTour();
    expect(screen.getByRole('dialog', { name: 'Ask here' })).toBeTruthy();
  });

  it('keeps looking while a page loads its controls', async () => {
    state.hints = [hint('create', 'catalog-create', 'Create an agent')];
    await startTour('/catalog');
    expect(screen.queryByRole('dialog')).toBeNull();

    await waitForCatalogThenRetry();
    expect(
      screen.getByRole('dialog', { name: 'Create an agent' }),
    ).toBeTruthy();
  });

  it('shows a page hint once the user navigates to that page', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    state.hints = [
      hint('new-chat', 'new-chat', 'Start a chat'),
      hint('create', 'catalog-create', 'Create an agent'),
    ];
    await startTour();

    /* The root page has no catalog: the tour shows the New chat hint only. */
    expect(
      screen.getByRole('dialog', { name: 'Start a chat' }).textContent,
    ).toContain('onboardingTour.stepCounter:1/1');
    await user.click(
      screen.getByRole('button', { name: 'onboardingTour.done' }),
    );
    expect(readSeen()).toEqual(['new-chat']);

    await user.click(screen.getByRole('link', { name: 'Go to catalog' }));
    await waitForCatalogThenRetry();
    expect(
      screen.getByRole('dialog', { name: 'Create an agent' }),
    ).toBeTruthy();
  });

  it('waits for the config to be ready', async () => {
    state.status = UserConfigStatus.Loading;
    await startTour();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
