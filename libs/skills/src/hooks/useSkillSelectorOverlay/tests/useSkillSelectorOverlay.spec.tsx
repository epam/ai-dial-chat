import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSkillSelectorOverlay } from '../useSkillSelectorOverlay';

describe('skill selection compatibility', () => {
  it('keeps an unresolved selection and rechecks support independently of metadata', () => {
    const { result, rerender } = renderHook(
      ({ supported, enabled, skills }) =>
        useSkillSelectorOverlay({
          isEnabled: enabled,
          isSkillsSupported: supported,
          skills,
          favoriteIds: new Set<string>(),
          onToggleFavorite: vi.fn(),
          renderCatalogContent: () => null,
          detailsPanelComponent: () => null,
        }),
      {
        initialProps: {
          supported: true,
          enabled: true,
          skills: [] as { url: string; name: string }[],
        },
      },
    );
    act(() => result.current.selectSkill('skills/public/deleted'));
    expect(result.current.selectedSkillElement).not.toBeNull();
    expect(result.current.selectedSkills).toEqual([
      { url: 'skills/public/deleted' },
    ]);
    rerender({ supported: false, enabled: true, skills: [] });
    expect(result.current.isSkillUnsupported).toBe(true);
    rerender({
      supported: true,
      enabled: true,
      skills: [{ url: 'skills/public/deleted', name: 'Resolved' }],
    });
    expect(result.current.isSkillUnsupported).toBe(false);
    rerender({ supported: false, enabled: false, skills: [] });
    expect(result.current.selectedSkillElement).toBeNull();
    expect(result.current.isSkillUnsupported).toBe(false);
    rerender({ supported: false, enabled: true, skills: [] });
    act(() => result.current.removeSelectedSkill());
    expect(result.current.isSkillUnsupported).toBe(false);
    expect(result.current.selectedSkills).toBeUndefined();
  });
});
