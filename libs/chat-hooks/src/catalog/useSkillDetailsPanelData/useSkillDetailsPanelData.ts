import type {
  CatalogItem,
  CatalogItemDetailsFetchResult,
} from '@epam/ai-dial-catalog';
import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import { useEffect, useMemo, useState } from 'react';
import { SkillSource } from '../../skill/skill-types';
import type { SkillFileContent } from '../../skill/skill-file-preview';
import { useSkillItemDetails } from '../useSkillItemDetails';
import type { SkillDetailsApi } from '../useSkillItemDetails';
import type { DeploymentFolderLabels } from './map-deployment-to-catalog-item';
import { mapSkillToCatalogItem } from './map-skill-to-catalog-item';
import type { SkillOverviewLabels } from './map-skill-to-catalog-item';

/** Options accepted by `useSkillDetailsPanelData`. */
export interface UseSkillDetailsPanelDataOptions {
  /** Configured API adapter used for all network calls. */
  api: SkillDetailsApi;
  /** The user's own skills. */
  skills: SkillMetadataItemDto[];
  /** Skills shared with the user. */
  sharedWithMe?: SkillMetadataItemDto[];
  /** Public skills. */
  publicSkills?: SkillMetadataItemDto[];
  /**
   * Resource URL (`skills/{bucket}/{path}`) of the skill whose details are
   * shown; `null` when the panel is closed, which resolves no item.
   */
  skillId: string | null;
  /** Personal/Shared/Public folder labels for the mapped item's folder path. */
  folderLabels: DeploymentFolderLabels;
  /** Labels for the skill overview section headers. */
  skillOverviewLabels: SkillOverviewLabels;
  /** Favorited resource ids, keyed by skill resource URL. */
  favoriteIds: ReadonlySet<string>;
}

/** Returned by `useSkillDetailsPanelData`. */
export interface UseSkillDetailsPanelDataResult {
  /**
   * The selected skill as a catalog item with its fetched details merged in;
   * `null` while no skill is selected or the skill is not in the listings.
   */
  detailsPanelItem: CatalogItem | null;
  /** Whether the details fetch for the current item is in flight. */
  isDetailsLoading: boolean;
  /** Whether the resolved skill is currently favorited. */
  isStarred: boolean;
  /**
   * Downloads and returns preview bytes for a file inside the open skill's
   * package. Throws on HTTP errors, unparseable ids, and size-limit
   * violations.
   */
  onLoadSkillDetailsFile(fileId: string): Promise<SkillFileContent>;
}

/**
 * Headless data pipeline behind a skill details side panel: resolves the
 * selected skill from the listings, maps it to a catalog item with its
 * ownership flags and folder prefix, fetches its details with cancellation,
 * and merges the fetch result into the item.
 */
export const useSkillDetailsPanelData = ({
  api,
  skills,
  sharedWithMe,
  publicSkills,
  skillId,
  folderLabels,
  skillOverviewLabels,
  favoriteIds,
}: UseSkillDetailsPanelDataOptions): UseSkillDetailsPanelDataResult => {
  const allSkills = useMemo<SkillMetadataItemDto[]>(
    () => [...skills, ...(sharedWithMe ?? []), ...(publicSkills ?? [])],
    [skills, sharedWithMe, publicSkills],
  );

  const { onFetchSkillDetails, onLoadSkillDetailsFile } = useSkillItemDetails({
    api,
    skills: allSkills,
    skillOverviewLabels,
  });

  const skill = useMemo(
    () => allSkills.find((candidate) => candidate.url === skillId) ?? null,
    [allSkills, skillId],
  );

  /*
   * The source decides the item's folder prefix and ownership flags; the
   * three listing arrays are disjoint, so the first match wins.
   */
  const skillSource = useMemo(() => {
    if (skills.some((candidate) => candidate.url === skillId)) {
      return SkillSource.Personal;
    }
    if (sharedWithMe?.some((candidate) => candidate.url === skillId)) {
      return SkillSource.SharedWithMe;
    }
    return SkillSource.Public;
  }, [skills, sharedWithMe, skillId]);

  const catalogItem = useMemo(() => {
    if (skill == null) return null;
    return mapSkillToCatalogItem(skill, {
      folderLabels,
      source: skillSource,
      favoriteIds,
    });
  }, [skill, skillSource, folderLabels, favoriteIds]);

  const [fetchedDetails, setFetchedDetails] =
    useState<CatalogItemDetailsFetchResult | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  useEffect(() => {
    if (catalogItem == null) return;

    /*
     * Keyed on the item's id rather than its identity: a favorite toggle
     * rebuilds the `CatalogItem` without changing what should load.
     * `onFetchSkillDetails` depends on the skills listing, and re-running on
     * listing refreshes would refetch details the panel already holds.
     */

    setIsDetailsLoading(true);
    setFetchedDetails(null);
    let isCancelled = false;

    onFetchSkillDetails(catalogItem).then((details) => {
      if (isCancelled) return;
      setFetchedDetails(details ?? null);
      setIsDetailsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the item's id only, so a rebuilt CatalogItem does not refetch
  }, [catalogItem?.id]);

  /*
   * Mirrors the Catalog page's merge: the fetch result's tab data lands on the
   * item; skills carry no credentials, so that channel stays empty.
   */
  const detailsPanelItem = useMemo(() => {
    if (catalogItem == null) return null;
    if (fetchedDetails == null) return catalogItem;
    const { credentials, ...tabData } = fetchedDetails;
    return {
      ...catalogItem,
      details: tabData,
      credentials: credentials ?? catalogItem.credentials,
    };
  }, [catalogItem, fetchedDetails]);

  return {
    detailsPanelItem,
    isDetailsLoading,
    isStarred: catalogItem != null && favoriteIds.has(catalogItem.id),
    onLoadSkillDetailsFile,
  };
};
