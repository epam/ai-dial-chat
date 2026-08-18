import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
}

export const SkillsContext = createContext<SkillsContextType | undefined>(
  undefined,
);

/**
 * Mounted once near the app root so the catalog reads one aggregate skill
 * listing per session.
 */
export const SkillsProvider = ({ children }: { children: ReactNode }) => {
  const [skills, setSkills] = useState<SkillMetadataItemDto[]>([]);
  const [publicSkills, setPublicSkills] = useState<SkillMetadataItemDto[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SkillMetadataItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const isSkillsEnabled = useUiFeature(OverlayFeature.Skills);
  const { status } = useUser();
  const isProfileSettled = status !== AuthStatus.Loading;

  const refetchSkills = useCallback(async () => {
    try {
      const response = await listCatalogSkills();
      setSkills(response.skills);
      setSharedWithMe(response.sharedWithMe);
      setPublicSkills(response.publicSkills);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    if (!isSkillsEnabled) {
      setSkills([]);
      setSharedWithMe([]);
      setPublicSkills([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    /* Keep the catalog skeleton visible until session identity is settled. */
    if (!isProfileSettled) return;

    const cancelled = { value: false };

    const load = async () => {
      const response = await listCatalogSkills().catch((reason: unknown) => {
        if (!cancelled.value) setError(reason);
        return null;
      });
      if (cancelled.value) return;

      if (response != null) {
        setSkills(response.skills);
        setSharedWithMe(response.sharedWithMe);
        setPublicSkills(response.publicSkills);
        setError(null);
      }

      setIsLoading(false);
    };

    load();

    return () => {
      cancelled.value = true;
    };
  }, [isProfileSettled, isSkillsEnabled]);

  const contextValue = useMemo(
    () => ({
      skills,
      sharedWithMe,
      publicSkills,
      isLoading,
      error,
      refetchSkills,
    }),
    [skills, sharedWithMe, publicSkills, isLoading, error, refetchSkills],
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
