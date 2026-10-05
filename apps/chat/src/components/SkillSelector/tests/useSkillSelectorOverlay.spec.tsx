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
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
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

  it('keeps hover-triggered history chips on desktop', () => {
    renderHook(() => useSkillSelectorOverlay({ isSkillsSupported: true }));

    expect(state.useHostOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ historyDetailsTrigger: undefined }),
    );
  });

  it('opens history chip tooltips on tap on mobile', () => {
    state.isMobile = true;

    renderHook(() => useSkillSelectorOverlay({ isSkillsSupported: true }));

    expect(state.useHostOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ historyDetailsTrigger: 'click' }),
    );
  });

  it('keeps hover-triggered details for active conversation mentions', () => {
    renderHook(() => useSkillSelectorOverlay({ isSkillsSupported: true }));

    expect(state.useHostOverlay).toHaveBeenCalledWith(
      expect.not.objectContaining({ activeMentionDetailsTrigger: 'click' }),
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
