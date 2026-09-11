import type { ItemDetailsTexts } from '@epam/ai-dial-catalog';
import { useSkillDetailsPanelData } from '@epam/ai-dial-chat-hooks';
import { SkillDetailsSidePanel } from '@epam/ai-dial-skills';
import { memo, useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
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
}

/*
 * `isReadonly` withholds the mutating actions and the favorite star but keeps
 * the primary action and Download, so both get an explicit never-visible rule
 * here — the panel a "View details" action opens shows the skill's
 * information only. The Download rule also guards the `isDownloadPrimary`
 * default that promotes a Skill's Download into the primary slot should this
 * call site ever gain an `onDownload`.
 */
const isNeverVisible = () => false;

/**
 * Chat-route container for the skill details side panel: feeds the skills and
 * favorites contexts plus the server API into the shared details pipeline,
 * and wires i18n texts and the app's file preview into
 * `SkillDetailsSidePanel`. Renders the panel read-only — selecting a skill
 * stays with the favorites rows, the slash menu, and the browse modal,
 * favorite toggling with the favorites rows, and the full action set with the
 * Catalog page's own details panel.
 */
const SkillDetailsPanelContainer: FC<Props> = ({ skillId, onClose }) => {
  const { t } = useTranslation();
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const { favoriteIds } = useFavoriteApplications();

  const skillDetailsApi = useMemo(
    () => ({ downloadSkillFile, listSkillFiles }),
    [],
  );

  const folderLabels = useMemo(() => buildDeploymentFolderLabels(t), [t]);
  const skillOverviewLabels = useMemo(() => buildSkillOverviewLabels(t), [t]);

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
      closeAriaLabel: t(ButtonsI18nKeys.Close),
    }),
    [t],
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
      isReadonly
      isPrimaryActionVisible={isNeverVisible}
      isDownloadVisible={isNeverVisible}
      onClose={onClose}
      renderContentFilePreview={renderContentFilePreview}
      texts={texts}
    />
  );
};

export default memo(SkillDetailsPanelContainer);
