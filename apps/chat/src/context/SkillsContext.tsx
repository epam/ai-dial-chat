import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillListResponseDto,
  type SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useUiFeature } from '../hooks/useUiFeature';
import { listSkills } from '../server-api/skills.api';
import { AuthStatus } from '../types/auth-status';
import {
  PUBLIC_SKILL_BUCKET,
  SKILL_LISTING_MAX_PAGES,
  SKILL_LISTING_PAGE_SIZE,
} from '../types/skill';
import { useUser } from './auth/UserContext';

export interface SkillsContextType {
  /** Skills in the caller's own bucket. */
  skills: SkillMetadataItemDto[];
  /** Skills in the organisation bucket. */
  publicSkills: SkillMetadataItemDto[];
  /** True until both listings have settled. */
  isLoading: boolean;
  /** Rejection reason of the most recent failed listing, or `null`. */
  error: unknown;
}

export const SkillsContext = createContext<SkillsContextType | undefined>(
  undefined,
);

/**
 * Reads one bucket's skills, following `nextToken` until the listing is
 * exhausted or `SKILL_LISTING_MAX_PAGES` is reached. Grouping folders are
 * dropped — their structure reaches the UI through each skill's `parentPath`,
 * not as standalone entries.
 */
const listAllSkills = async (
  bucket: string,
): Promise<SkillMetadataItemDto[]> => {
  const items: SkillMetadataItemDto[] = [];
  let token: string | undefined;

  for (let page = 0; page < SKILL_LISTING_MAX_PAGES; page += 1) {
    const response: SkillListResponseDto = await listSkills({
      bucket,
      path: '',
      recursive: true,
      limit: SKILL_LISTING_PAGE_SIZE,
      ...(token ? { token } : {}),
    });

    items.push(
      ...response.items.filter(
        (item) => item.nodeType === SkillMetadataItemDtoNodeTypeEnum.Item,
      ),
    );

    if (!response.nextToken) return items;
    token = response.nextToken;
  }

  /* Never present a truncated listing as complete. */
  console.warn(
    `Skill listing for bucket "${bucket}" stopped after ${SKILL_LISTING_MAX_PAGES} pages; the listing may be incomplete.`,
  );
  return items;
};

/**
 * Mounted once near the app root so the catalog reads one skill listing per
 * session. The caller's own bucket and the organisation bucket load
 * independently: an organisation-bucket outage must not hide the caller's own
 * skills, and vice versa.
 */
export const SkillsProvider = ({ children }: { children: ReactNode }) => {
  const [skills, setSkills] = useState<SkillMetadataItemDto[]>([]);
  const [publicSkills, setPublicSkills] = useState<SkillMetadataItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const isSkillsEnabled = useUiFeature(OverlayFeature.Skills);
  const { status, user } = useUser();
  const bucket = user?.bucket ?? '';
  const isProfileSettled = status !== AuthStatus.Loading;

  useEffect(() => {
    if (!isSkillsEnabled) {
      setSkills([]);
      setPublicSkills([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    /*
     * The personal bucket arrives with the user profile. Staying in the
     * loading state until the profile settles keeps the catalog's skeleton up
     * instead of briefly rendering an empty Skills tab — but only until it
     * settles: a profile that resolves without a bucket must not leave the
     * catalog loading forever, so the organisation listing proceeds alone.
     */
    if (bucket === '' && !isProfileSettled) return;

    const cancelled = { value: false };

    const load = async () => {
      const [personal, organisation] = await Promise.allSettled([
        bucket === ''
          ? Promise.resolve<SkillMetadataItemDto[]>([])
          : listAllSkills(bucket),
        listAllSkills(PUBLIC_SKILL_BUCKET),
      ]);
      if (cancelled.value) return;

      if (personal.status === 'fulfilled') {
        setSkills(personal.value);
      } else {
        setError(personal.reason);
      }

      if (organisation.status === 'fulfilled') {
        setPublicSkills(organisation.value);
      } else {
        setError(organisation.reason);
      }

      setIsLoading(false);
    };

    load();

    return () => {
      cancelled.value = true;
    };
  }, [bucket, isProfileSettled, isSkillsEnabled]);

  const contextValue = useMemo(
    () => ({ skills, publicSkills, isLoading, error }),
    [skills, publicSkills, isLoading, error],
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
