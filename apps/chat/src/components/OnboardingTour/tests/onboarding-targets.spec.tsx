import { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveOnboardingTarget,
  type OnboardingTargetLabels,
} from '../onboarding-targets';

const labels: OnboardingTargetLabels = {
  newChat: 'New chat',
  navigation: 'Main navigation',
  projects: 'Projects',
  scheduledTasks: 'Scheduled tasks',
  catalog: 'Catalog',
  fileManager: 'File manager',
  addAttachment: 'Add',
  catalogCreate: 'Create',
  catalogViewMode: 'View mode',
};

const Page = ({ inertNav = false }: { inertNav?: boolean }) => (
  <>
    <nav aria-label="Main navigation" inert={inertNav}>
      <a href="/">New chat</a>
      <a href="/projects">Projects</a>
      <a href="/scheduled-tasks">Scheduled tasks</a>
      <a href="/catalog">Catalog</a>
      <a href="/file-manager">File manager</a>
    </nav>
    <main id="main-content">
      {/* Same name outside the nav must not win a nav target. */}
      <button type="button">Catalog</button>
      <textarea aria-label="Message" />
      <button type="button" aria-label="Add">
        +
      </button>
      <section aria-label="Catalog">
        <button type="button">Create</button>
        <div role="radiogroup" aria-label="View mode" />
        <div role="search">
          <input aria-label="Search the catalog" />
        </div>
        <div role="tablist" aria-label="Entity types" />
      </section>
    </main>
  </>
);

/* The root page: the same controls exist, but not in a catalog region. */
const RootPage = () => (
  <main id="main-content">
    <button type="button">Create</button>
    <div role="tablist" aria-label="Other tabs" />
  </main>
);

describe('resolveOnboardingTarget', () => {
  beforeEach(() => {
    /* jsdom lays nothing out; give every element a box. */
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
      { top: 0, left: 0, width: 10, height: 10 },
    ] as unknown as DOMRectList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [OnboardingHintTarget.Projects, 'Projects'],
    [OnboardingHintTarget.ScheduledTasks, 'Scheduled tasks'],
    [OnboardingHintTarget.Catalog, 'Catalog'],
    [OnboardingHintTarget.FileManager, 'File manager'],
    [OnboardingHintTarget.NewChat, 'New chat'],
  ])('finds the %s link in the navigation', (target, name) => {
    render(<Page />);
    expect(resolveOnboardingTarget(target, labels)).toBe(
      screen.getByRole('link', { name }),
    );
  });

  it('finds the navigation landmark', () => {
    render(<Page />);
    expect(
      resolveOnboardingTarget(OnboardingHintTarget.Navigation, labels),
    ).toBe(screen.getByRole('navigation', { name: 'Main navigation' }));
  });

  it('finds the composer and its + button', () => {
    render(<Page />);
    expect(
      resolveOnboardingTarget(OnboardingHintTarget.ConversationInput, labels),
    ).toBe(screen.getByRole('textbox', { name: 'Message' }));
    expect(
      resolveOnboardingTarget(OnboardingHintTarget.AddAttachment, labels),
    ).toBe(screen.getByRole('button', { name: 'Add' }));
  });

  it('finds the catalog controls inside the catalog region', () => {
    render(<Page />);
    const catalog = screen.getByRole('region', { name: 'Catalog' });
    expect(
      resolveOnboardingTarget(OnboardingHintTarget.CatalogCreate, labels),
    ).toBe(within(catalog).getByRole('button', { name: 'Create' }));
    expect(
      resolveOnboardingTarget(OnboardingHintTarget.CatalogSearch, labels),
    ).toBe(within(catalog).getByRole('search'));
    expect(
      resolveOnboardingTarget(OnboardingHintTarget.CatalogTabs, labels),
    ).toBe(within(catalog).getByRole('tablist'));
    expect(
      resolveOnboardingTarget(OnboardingHintTarget.CatalogViewMode, labels),
    ).toBe(within(catalog).getByRole('radiogroup', { name: 'View mode' }));
  });

  it('finds no catalog control outside the catalog page', () => {
    render(<RootPage />);
    for (const target of [
      OnboardingHintTarget.CatalogCreate,
      OnboardingHintTarget.CatalogSearch,
      OnboardingHintTarget.CatalogTabs,
      OnboardingHintTarget.CatalogViewMode,
    ]) {
      expect(resolveOnboardingTarget(target, labels)).toBeNull();
    }
  });

  it('skips links inside an inert navigation, such as a closed drawer', () => {
    render(<Page inertNav />);
    expect(
      resolveOnboardingTarget(OnboardingHintTarget.Catalog, labels),
    ).toBeNull();
  });

  it('returns null for an element with no box', () => {
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue(
      [] as unknown as DOMRectList,
    );
    render(<Page />);
    expect(
      resolveOnboardingTarget(OnboardingHintTarget.Projects, labels),
    ).toBeNull();
  });
});
