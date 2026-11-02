import type { SkillsContextType } from '../SkillsContext';

/** Builds a full `useSkills()` value for tests, defaulting to an empty, settled listing. */
export const createSkillsContextValue = (
  overrides: Partial<SkillsContextType> = {},
): SkillsContextType => ({
  skills: [],
  publicSkills: [],
  sharedWithMe: [],
  isLoading: false,
  error: null,
  refetchSkills: async () => undefined,
  mergeSharedSkill: () => undefined,
  ...overrides,
});

const EMPTY_SKILLS_VALUE = createSkillsContextValue();

/*
 * Stand-in for `context/SkillsContext` in specs that render a component reading
 * the skill listings but never provide `SkillsProvider`:
 *
 *   vi.mock('<relative>/context/SkillsContext', async () =>
 *     import('<relative>/context/tests/skills-context-mock'),
 *   );
 */
export const useSkills = (): SkillsContextType => EMPTY_SKILLS_VALUE;
