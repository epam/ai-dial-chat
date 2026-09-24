import { FavoriteEntityType } from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { BottomSheetShell } from '@epam/ai-dial-conversation-input';
import {
  buildFavoriteSkillItem,
  SkillSelectorField,
  type SkillSelectorFieldProps,
} from '@epam/ai-dial-skills';
import { lazy, memo, useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  FavoritesI18nKeys,
  PromptSelectorI18nKeys,
  ScheduledTasksI18nKeys,
  SkillSelectorI18nKeys,
} from '../../constants/translation-keys';
import { useFavoriteApplications } from '../../context/FavoriteApplicationsContext';
import { useSkills } from '../../context/SkillsContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useScheduledTaskSkillDisplayName } from '../../hooks/scheduled-tasks/useScheduledTaskSkillDisplayName';

const CatalogView = lazy(() => import('../CatalogView/CatalogView'));
const SKILL_ONLY_TYPES = new Set([CatalogEntityType.Skill]);
const renderCatalogContent: SkillSelectorFieldProps['renderCatalogContent'] = (
  onSelect,
  onClose,
) => (
  <CatalogView
    isSelectorMode
    onSelect={onSelect}
    onClose={onClose}
    visibleTypes={SKILL_ONLY_TYPES}
  />
);

/** App catalog and translation adapter for the reusable controlled field. */
const ScheduledTaskSkillField: FC<
  Omit<
    SkillSelectorFieldProps,
    | 'labels'
    | 'renderCatalogContent'
    | 'displayName'
    | 'favorites'
    | 'onToggleFavorite'
    | 'onViewDetails'
    | 'renderOverlay'
  >
> = (props) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();
  const favorites = useMemo(() => {
    const entries = new Map(
      [...skills, ...(sharedWithMe ?? []), ...publicSkills].map((skill) => [
        skill.url,
        skill,
      ]),
    );
    return [...entries.values()]
      .filter((skill) => favoriteIds.has(skill.url))
      .map(buildFavoriteSkillItem);
  }, [skills, sharedWithMe, publicSkills, favoriteIds]);
  const handleToggleFavorite = useCallback(
    (id: string) => {
      void toggleFavorite(id, false, FavoriteEntityType.Skill);
    },
    [toggleFavorite],
  );
  const displayName = useScheduledTaskSkillDisplayName(props.value);
  const labels = useMemo(
    () => ({
      placeholder: t(ScheduledTasksI18nKeys.CreateSkillPlaceholder),
      modalTitle: t(SkillSelectorI18nKeys.ModalTitle),
      removeSkillLabel: t(SkillSelectorI18nKeys.RemoveSkillLabel),
      unsupportedTooltipLabel: t(SkillSelectorI18nKeys.UnsupportedTooltipLabel),
      searchPlaceholder: t(BasicI18nKeys.SearchPlaceholder),
      clearSearchLabel: t(BasicI18nKeys.ClearSearch),
      panelLabels: {
        myCollectionLabel: t(PromptSelectorI18nKeys.MyCollectionLabel),
        emptyHintLabel: t(SkillSelectorI18nKeys.EmptyHint),
        browseLabel: t(ButtonsI18nKeys.Browse),
        removeFromFavoritesLabel: t(FavoritesI18nKeys.RemoveFromFavorites),
        noMatchingSkillsLabel: t(SkillSelectorI18nKeys.NoMatchingSkillsLabel),
      },
    }),
    [t],
  );
  return (
    <SkillSelectorField
      {...props}
      displayName={displayName}
      renderCatalogContent={renderCatalogContent}
      labels={labels}
      favorites={favorites}
      onToggleFavorite={handleToggleFavorite}
      renderOverlay={
        isMobile
          ? (panel, open, close) => (
              <BottomSheetShell
                isOpen={open}
                onClose={close}
                title={labels.modalTitle}
                closeLabel={t(ButtonsI18nKeys.Close)}
                className="max-h-[90dvh]"
              >
                {panel}
              </BottomSheetShell>
            )
          : undefined
      }
    />
  );
};

export default memo(ScheduledTaskSkillField);
