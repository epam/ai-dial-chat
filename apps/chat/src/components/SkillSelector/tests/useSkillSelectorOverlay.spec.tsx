import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkillSelectorOverlay } from '../useSkillSelectorOverlay';

const state = vi.hoisted(() => ({
  useHostOverlay: vi.fn(() => ({ seedSkillMentions: vi.fn() })),
}));

vi.mock('@epam/ai-dial-skills', () => ({
  getSkillFallbackName: (url: string) => url,
  useSkillSelectorOverlay: state.useHostOverlay,
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: () => true,
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
  useIsMobile: () => false,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('useSkillSelectorOverlay', () => {
  beforeEach(() => {
    state.useHostOverlay.mockClear();
  });

  it('keeps hover-triggered details for active conversation mentions', () => {
    renderHook(() => useSkillSelectorOverlay({ isSkillsSupported: true }));

    expect(state.useHostOverlay).toHaveBeenCalledWith(
      expect.not.objectContaining({ activeMentionDetailsTrigger: 'click' }),
    );
  });
});
