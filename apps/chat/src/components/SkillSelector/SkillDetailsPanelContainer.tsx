import type { CatalogItem, ItemDetailsTexts } from '@epam/ai-dial-catalog';
import {
  FavoriteEntityType,
  useSkillDetailsPanelData,
} from '@epam/ai-dial-chat-hooks';
import { SkillDetailsSidePanel } from '@epam/ai-dial-skills';
import { memo, useCallback, useMemo, type FC } from 'react';
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
 * Chat-route container for the skill details side panel: feeds the skills and
 * favorites contexts plus the server API into the shared details pipeline,
 * and wires i18n texts and the app's file preview into
 * `SkillDetailsSidePanel`.
 */
const SkillDetailsPanelContainer: FC<Props> = ({
  skillId,
  onClose,
  onUseInChat,
}) => {
  const { t } = useTranslation();
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();

  const skillDetailsApi = useMemo(
    () => ({ downloadSkillFile, listSkillFiles }),
    [],
  );

  const folderLabels = useMemo(() => buildDeploymentFolderLabels(t), [t]);
  const skillOverviewLabels = useMemo(
    () => buildSkillOverviewLabels(t),
    [t],
  );

  const {
    detailsPanelItem,
    isDetailsLoading,
    isStarred,
    onLoadSkillDetailsFile,
  } = useSkillDetailsPanelData({
    api: skillDetailsApi,
    skills,
    sharedWithMe,
    publicSkills,
    skillId,
    folderLabels,
    skillOverviewLabels,
    favoriteIds,
  });

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
    (id: string, isFavorite: boolean) => {
      /* Silent by design, matching the favorites panel's non-notifying toggle. */
      void toggleFavorite(id, isFavorite, FavoriteEntityType.Skill);
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

  if (detailsPanelItem == null) return null;

  return (
    <SkillDetailsSidePanel
      item={detailsPanelItem}
      isOpen={skillId != null}
      isStarred={isStarred}
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
