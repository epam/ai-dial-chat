import type {
  CatalogItem,
  CatalogItemDetailsFetchResult,
  ItemDetailsTexts,
} from '@epam/ai-dial-catalog';
import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import {
  FavoriteEntityType,
  mapSkillToCatalogItem,
  type SkillDetailsApi,
  SkillSource,
  useSkillItemDetails,
} from '@epam/ai-dial-chat-hooks';
import { SkillDetailsSidePanel } from '@epam/ai-dial-skills';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  FavoritesI18nKeys,
} from '../../constants/translation-keys';
import { useFavoriteApplications } from '../../context/FavoriteApplicationsContext';
import { useSkills } from '../../context/SkillsContext';
import { downloadSkillFile, listSkillFiles } from '../../server-api/skills.api';
import { buildSkillOverviewLabels } from '../../utils/catalog';
import { buildDeploymentFolderLabels } from '../../utils/map-deployment-to-catalog-item';
import { SkillDetailsFilePreview } from '../CatalogView/SkillDetailsFilePreview';

interface Props {
  /** Resource URL (`skills/{bucket}/{path}`) of the skill whose details are shown; `null` renders nothing. */
  skillId: string | null;
  /** Called when the panel should close (close button or backdrop click). */
  onClose: () => void;
  /** Called with the skill's resource URL when the panel's "Use in chat" is clicked; the host also closes the panel. */
  onUseInChat: (skillId: string) => void;
}

/**
 * Chat-route container for the skill details side panel: resolves the
 * selected skill from the skills context into a catalog item, fetches its
 * details through the shared skill pipeline, and wires favorites and
 * "Use in chat" into `SkillDetailsSidePanel`.
 */
const SkillDetailsPanelContainer: FC<Props> = ({
  skillId,
  onClose,
  onUseInChat,
}) => {
  const { t } = useTranslation();
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();

  const skillDetailsApi: SkillDetailsApi = useMemo(
    () => ({ downloadSkillFile, listSkillFiles }),
    [],
  );

  const allSkills = useMemo<SkillMetadataItemDto[]>(
    () => [...skills, ...(sharedWithMe ?? []), ...publicSkills],
    [skills, sharedWithMe, publicSkills],
  );

  const skillOverviewLabels = useMemo(() => buildSkillOverviewLabels(t), [t]);

  const { onFetchSkillDetails, onLoadSkillDetailsFile } = useSkillItemDetails({
    api: skillDetailsApi,
    skills: allSkills,
    skillOverviewLabels,
  });

  const skill = useMemo(
    () => allSkills.find((candidate) => candidate.url === skillId) ?? null,
    [allSkills, skillId],
  );

  /*
   * The source decides the item's folder prefix and ownership flags; the
   * three context arrays are disjoint, so the first match wins.
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
      folderLabels: buildDeploymentFolderLabels(t),
      source: skillSource,
      favoriteIds,
    });
  }, [skill, skillSource, t, favoriteIds]);

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
   * Mirrors the Catalog page's merge: the fetch result's tab data lands on
   * the item; skills carry no credentials, so that channel stays empty.
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

  const texts = useMemo<ItemDetailsTexts>(
    () => ({
      tabContentLabel: t(CatalogI18nKeys.DetailsTabContent),
      contentFileSelectorAriaLabel: t(
        CatalogI18nKeys.DetailsContentFileSelectorAriaLabel,
      ),
      contentFileCountLabel: (count) =>
        t(CatalogI18nKeys.DetailsContentFileCount, { count }),
      contentFileLoadingLabel: t(CatalogI18nKeys.DetailsContentFileLoading),
      contentFileErrorLabel: t(CatalogI18nKeys.DetailsContentFileError),
      contentFileUnsupportedLabel: t(
        CatalogI18nKeys.DetailsContentFileUnsupported,
      ),
      primaryActionLabel: t(ButtonsI18nKeys.UseInChat),
      closeAriaLabel: t(ButtonsI18nKeys.Close),
      addToFavoritesAriaLabel: t(FavoritesI18nKeys.AddToFavorites),
      removeFromFavoritesAriaLabel: t(FavoritesI18nKeys.RemoveFromFavorites),
    }),
    [t],
  );

  /*
   * The whole panel renders only behind the `skillUsageEnabled` flag, so the
   * primary action needs no second gate here. Deferred condition: once the
   * backend exposes whether the selected default model supports skills, this
   * rule gains that signal.
   */
  const isPrimaryActionVisible = useCallback(() => true, []);

  const handleToggleFavorite = useCallback(
    (id: string, isStarred: boolean) => {
      /* Silent by design, matching the favorites panel's non-notifying toggle. */
      void toggleFavorite(id, isStarred, FavoriteEntityType.Skill);
    },
    [toggleFavorite],
  );

  const handleUseInChat = useCallback(
    (item: CatalogItem) => {
      onUseInChat(item.id);
    },
    [onUseInChat],
  );

  const renderContentFilePreview = useCallback(
    (fileId: string, fileName: string) => (
      <SkillDetailsFilePreview
        fileId={fileId}
        fileName={fileName}
        onLoadFile={onLoadSkillDetailsFile}
      />
    ),
    [onLoadSkillDetailsFile],
  );

  if (catalogItem == null || detailsPanelItem == null) return null;

  return (
    <SkillDetailsSidePanel
      item={detailsPanelItem}
      isOpen={skillId != null}
      isStarred={favoriteIds.has(catalogItem.id)}
      isDetailsLoading={isDetailsLoading}
      onClose={onClose}
      onToggleFavorite={handleToggleFavorite}
      onUseInChat={handleUseInChat}
      isPrimaryActionVisible={isPrimaryActionVisible}
      renderContentFilePreview={renderContentFilePreview}
      texts={texts}
    />
  );
};

export default memo(SkillDetailsPanelContainer);
