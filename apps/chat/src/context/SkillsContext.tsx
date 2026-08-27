import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import { useSkillsState } from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useUiFeature } from '../hooks/useUiFeature';
import { listCatalogSkills } from '../server-api/skills.api';
import { AuthStatus } from '../types/auth-status';
import { useUser } from './auth/UserContext';

export interface SkillsContextType {
  /** Skills in the caller's own bucket. */
  skills: SkillMetadataItemDto[];
  /** Skills in the organisation bucket. */
  publicSkills: SkillMetadataItemDto[];
  /** Skills other users shared with the caller. */
  sharedWithMe?: SkillMetadataItemDto[];
  /** True until the aggregate listing has settled. */
  isLoading: boolean;
  /** Rejection reason of the most recent failed listing, or `null`. */
  error: unknown;
  /** Re-reads personal, shared, and organisation skills. */
  refetchSkills: () => Promise<void>;
  /** Upserts a single skill into the shared-with-me list, e.g. right after a share invitation is accepted. */
  mergeSharedSkill: (item: SkillMetadataItemDto) => void;
}

export const SkillsContext = createContext<SkillsContextType | undefined>(
  undefined,
);

/**
 * Mounted once near the app root so the catalog reads one aggregate skill
 * listing per session.
 */
export const SkillsProvider = ({ children }: { children: ReactNode }) => {
  const enabled = useUiFeature(OverlayFeature.Skills);
  const { status } = useUser();
  const ready = status !== AuthStatus.Loading;

  const state = useSkillsState({
    listSkills: listCatalogSkills,
    enabled,
    ready,
  });

  const contextValue = useMemo<SkillsContextType>(
    () => ({
      skills: state.skills,
      sharedWithMe: state.sharedWithMe,
      publicSkills: state.publicSkills,
      isLoading: state.isLoading,
      error: state.error,
      refetchSkills: state.refetch,
      mergeSharedSkill: state.mergeSharedSkill,
    }),
    [state],
  );

  return (
    <SkillsContext.Provider value={contextValue}>
      {children}
    </SkillsContext.Provider>
  );
};

export const useSkills = (): SkillsContextType => {
  const context = useContext(SkillsContext);
  if (!context) {
    throw new Error('useSkills must be used within a SkillsProvider');
  }
  return context;
};
