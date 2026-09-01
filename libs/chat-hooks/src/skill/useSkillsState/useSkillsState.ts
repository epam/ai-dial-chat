import type {
  SkillCatalogListResponseDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Parameters for {@link useSkillsState}. */
export interface UseSkillsStateParams {
  /** Fetches the aggregate skill listing from the server. */
  listSkills: () => Promise<SkillCatalogListResponseDto>;
  /** Whether the Skills feature is enabled in the current overlay/tenant config. */
  enabled: boolean;
  /** Whether the user session is ready for API calls (auth has settled). */
  ready: boolean;
}

/** Result returned by {@link useSkillsState}. */
export interface UseSkillsStateResult {
  /** Skills in the caller's own bucket. */
  skills: SkillMetadataItemDto[];
  /** Skills in the organisation bucket. */
  publicSkills: SkillMetadataItemDto[];
  /** Skills other users shared with the caller. */
  sharedWithMe: SkillMetadataItemDto[];
  /** True until the aggregate listing has settled. */
  isLoading: boolean;
  /** Rejection reason of the most recent failed listing, or `null`. */
  error: unknown;
  /** Re-reads personal, shared, and organisation skills. */
  refetch: () => Promise<void>;
  /** Upserts a single skill into the shared-with-me list by URL identity. */
  mergeSharedSkill: (item: SkillMetadataItemDto) => void;
}

/**
 * Fetches all skill namespaces with a gated single request: clears state
 * immediately when `enabled` is false, defers the fetch until `ready` is true,
 * and exposes `refetch` / `mergeSharedSkill` for manual updates.
 * Does not import any feature-flag hook, auth enum, or app context.
 */
export const useSkillsState = ({
  listSkills,
  enabled,
  ready,
}: UseSkillsStateParams): UseSkillsStateResult => {
  const [skills, setSkills] = useState<SkillMetadataItemDto[]>([]);
  const [publicSkills, setPublicSkills] = useState<SkillMetadataItemDto[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SkillMetadataItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refetch = useCallback(async () => {
    try {
      const response = await listSkills();
      setSkills(response.skills);
      setSharedWithMe(response.sharedWithMe);
      setPublicSkills(response.publicSkills);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [listSkills]);

  useEffect(() => {
    if (!enabled) {
      setSkills([]);
      setSharedWithMe([]);
      setPublicSkills([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    /* Keep the loading state visible until session identity has settled. */
    if (!ready) return;

    const cancelled = { value: false };

    const load = async () => {
      const response = await listSkills().catch((reason: unknown) => {
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
  }, [enabled, ready, listSkills]);

  const mergeSharedSkill = useCallback((item: SkillMetadataItemDto) => {
    setSharedWithMe((prev) => [
      ...prev.filter((skill) => skill.url !== item.url),
      item,
    ]);
  }, []);

  return useMemo(
    () => ({
      skills,
      publicSkills,
      sharedWithMe,
      isLoading,
      error,
      refetch,
      mergeSharedSkill,
    }),
    [
      skills,
      publicSkills,
      sharedWithMe,
      isLoading,
      error,
      refetch,
      mergeSharedSkill,
    ],
  );
};
