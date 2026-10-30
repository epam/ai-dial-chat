import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkillSelectorOverlay } from '../useSkillSelectorOverlay';

const state = vi.hoisted(() => ({
  useHostOverlay: vi.fn(() => ({ seedSkillMentions: vi.fn() })),
  isMobile: false,
}));

vi.mock('@epam/ai-dial-skills', () => ({
  getSkillFallbackName: (url: string) => url,
  useSkillSelectorOverlay: state.useHostOverlay,
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'my-bucket' } }),
}));
vi.mock('../../../context/FavoriteApplicationsContext', () => ({
  useFavoriteApplications: () => ({
    favoriteIds: new Set(),
    toggleFavorite: vi.fn(),
  }),
}));
vi.mock('../../../context/SkillsContext', () => ({
  useSkills: () => ({ skills: [], sharedWithMe: [], publicSkills: [] }),
}));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useIsMobile: () => state.isMobile,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('useSkillSelectorOverlay', () => {
  beforeEach(() => {
    state.useHostOverlay.mockClear();
    state.isMobile = false;
  });

  it.each([false, true])(
    'opens history and composer chip details on click (isMobile: %s)',
    (isMobile) => {
      state.isMobile = isMobile;

      renderHook(() => useSkillSelectorOverlay({ isSkillsSupported: true }));

      expect(state.useHostOverlay).toHaveBeenCalledWith(
        expect.objectContaining({
          historyDetailsTrigger: 'click',
          activeMentionDetailsTrigger: 'click',
        }),
      );
    },
  );

  it('hides the favorites-panel row tooltips', () => {
    renderHook(() => useSkillSelectorOverlay({ isSkillsSupported: true }));

    expect(state.useHostOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ isRowTooltipHidden: true }),
    );
  });

  it('forwards the viewer bucket and the unresolved-skill tooltip labels', () => {
    renderHook(() => useSkillSelectorOverlay({ isSkillsSupported: true }));

    expect(state.useHostOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerBucket: 'my-bucket',
        labels: expect.objectContaining({
          deletedTooltipLabel: 'skillSelector.deletedTooltipLabel',
          notSharedTooltipLabel: 'skillSelector.notSharedTooltipLabel',
        }),
      }),
    );
  });
});
