import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageKey } from '../../../types/storage-key';
import type { AnnouncementContent } from '../../../utils/announcement-message';
import { useAnnouncementDismissal } from '../useAnnouncementDismissal';

const LEGACY_MESSAGE = 'Welcome to <b>DIAL</b>!';

const makeContent = (
  overrides?: Partial<AnnouncementContent>,
): AnnouncementContent => ({
  title: null,
  description: null,
  html: null,
  ...overrides,
});

const renderDismissal = (content: AnnouncementContent) =>
  renderHook(() => useAnnouncementDismissal(content));

const readStored = () =>
  localStorage.getItem(StorageKey.TextOfClosedAnnouncement);

describe('useAnnouncementDismissal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports an announcement as not dismissed when nothing is persisted', () => {
    const { result } = renderDismissal(makeContent({ title: 'Welcome' }));

    expect(result.current.isDismissed).toBe(false);
  });

  it('persists the signature and marks the announcement dismissed', () => {
    const { result } = renderDismissal(
      makeContent({ title: 'Welcome', description: 'Explore DIAL.' }),
    );

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isDismissed).toBe(true);
    expect(readStored()).toBe(
      JSON.stringify(
        JSON.stringify({ title: 'Welcome', description: 'Explore DIAL.' }),
      ),
    );
  });

  it('keeps an unchanged announcement dismissed across remounts', () => {
    const content = makeContent({ title: 'Welcome', description: 'Explore.' });
    const { result: firstResult, unmount: unmountFirst } =
      renderDismissal(content);

    act(() => {
      firstResult.current.dismiss();
    });
    unmountFirst();

    const { result: secondResult } = renderDismissal(content);
    expect(secondResult.current.isDismissed).toBe(true);
  });

  it('re-shows the banner when the title changes', () => {
    const { result: firstResult, unmount: unmountFirst } = renderDismissal(
      makeContent({ title: 'Welcome' }),
    );

    act(() => {
      firstResult.current.dismiss();
    });
    unmountFirst();

    const { result: secondResult } = renderDismissal(
      makeContent({ title: 'Welcome back' }),
    );
    expect(secondResult.current.isDismissed).toBe(false);
  });

  it('re-shows the banner when the description changes', () => {
    const { result: firstResult, unmount: unmountFirst } = renderDismissal(
      makeContent({ title: 'Welcome', description: 'Explore DIAL.' }),
    );

    act(() => {
      firstResult.current.dismiss();
    });
    unmountFirst();

    const { result: secondResult } = renderDismissal(
      makeContent({ title: 'Welcome', description: 'Explore DIAL today.' }),
    );
    expect(secondResult.current.isDismissed).toBe(false);
  });

  it('re-shows the banner when the legacy message changes', () => {
    const { result: firstResult, unmount: unmountFirst } = renderDismissal(
      makeContent({ html: LEGACY_MESSAGE }),
    );

    act(() => {
      firstResult.current.dismiss();
    });
    unmountFirst();

    const { result: secondResult } = renderDismissal(
      makeContent({ html: 'Something else' }),
    );
    expect(secondResult.current.isDismissed).toBe(false);
  });

  it('stores the raw message for a legacy-only announcement', () => {
    const { result } = renderDismissal(makeContent({ html: LEGACY_MESSAGE }));

    act(() => {
      result.current.dismiss();
    });

    expect(readStored()).toBe(JSON.stringify(LEGACY_MESSAGE));
  });

  it('honours a dismissal recorded before the structured fields existed', () => {
    /* What a pre-upgrade build wrote: the raw message, nothing else. */
    localStorage.setItem(
      StorageKey.TextOfClosedAnnouncement,
      JSON.stringify(LEGACY_MESSAGE),
    );

    const { result } = renderDismissal(makeContent({ html: LEGACY_MESSAGE }));

    expect(result.current.isDismissed).toBe(true);
  });

  it('ignores the legacy message once structured content is configured', () => {
    localStorage.setItem(
      StorageKey.TextOfClosedAnnouncement,
      JSON.stringify(LEGACY_MESSAGE),
    );

    const { result } = renderDismissal(
      makeContent({ title: 'Welcome', html: LEGACY_MESSAGE }),
    );

    expect(result.current.isDismissed).toBe(false);
  });
});
