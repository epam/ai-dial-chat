import {
  FavoriteEntityType,
  fetchSkillDescription as fetchSkillManifestDescription,
} from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import {
  useSkillSelectorOverlay as useHostAgnosticSkillSelectorOverlay,
  type SkillSelectorOverlayLabels,
  type UseSkillSelectorOverlayResult,
} from '@epam/ai-dial-skills';
import { lazy, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  FavoritesI18nKeys,
  NavigationI18nKeys,
  PromptSelectorI18nKeys,
  SkillSelectorI18nKeys,
} from '../../constants/translation-keys';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useFavoriteApplications } from '../../context/FavoriteApplicationsContext';
import { useSkills } from '../../context/SkillsContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { downloadSkillFile } from '../../server-api/skills.api';

const CatalogView = lazy(async () => {
  const module = await import('../CatalogView/CatalogView');
  return { default: module.default };
});

const SkillDetailsPanelContainer = lazy(async () => {
  const module = await import('./SkillDetailsPanelContainer');
  return { default: module.default };
});

/* Stable identity so CatalogView's selector-mode filter doesn't rebuild every render. */
const SKILL_ONLY_TYPES = new Set<CatalogEntityType>([CatalogEntityType.Skill]);

/* Stable identity: mounting the lazy CatalogView chunk is the only state it touches. */
const renderCatalogContent = (
  onSelect: (id: string) => void,
  onClose: () => void,
) => (
  <CatalogView
    isSelectorMode
    onClose={onClose}
    onSelect={onSelect}
    visibleTypes={SKILL_ONLY_TYPES}
  />
);

/**
 * Host wiring for the lib's skill selector overlay hook: the
 * `skillUsageEnabled` feature flag, the skills and favorites contexts, i18n
 * labels, the server-API-backed description fetch, the catalog picker
 * content, and the app-owned details panel component.
 */
export const useSkillSelectorOverlay = (): UseSkillSelectorOverlayResult => {
  const isEnabled = useFeatureFlag('skillUsageEnabled');
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();

  const handleFetchSkillDescription = useCallback(
    (skillId: string) =>
      fetchSkillManifestDescription({ downloadSkillFile }, skillId),
    [],
  );

  /* Silent by design: the favorites overlay's star toggle never notifies. */
  const handleToggleFavorite = useCallback(
    (id: string) => {
      void toggleFavorite(id, false, FavoriteEntityType.Skill);
    },
    [toggleFavorite],
  );

  /*
   * "My Collection" reuses the prompt selector's key: it is the only
   * feature-scoped key carrying that exact value, and the panel's wording is
   * shared across every "selected list" overlay, not prompt-specific.
   */
  const labels = useMemo<SkillSelectorOverlayLabels>(
    () => ({
      addMenuLabel: t(SkillSelectorI18nKeys.AddMenuLabel),
      backLabel: t(NavigationI18nKeys.Back),
      catalogModalTitleLabel: t(SkillSelectorI18nKeys.ModalTitle),
      emptyQueryHintLabel: t(SkillSelectorI18nKeys.EmptyQueryHint),
      panelLabels: {
        myCollectionLabel: t(PromptSelectorI18nKeys.MyCollectionLabel),
        emptyHintLabel: t(SkillSelectorI18nKeys.EmptyHint),
        browseLabel: t(ButtonsI18nKeys.Browse),
        removeFromFavoritesLabel: t(FavoritesI18nKeys.RemoveFromFavorites),
        viewDetailsLabel: t(SkillSelectorI18nKeys.ViewDetailsLabel),
        noMatchingSkillsLabel: t(SkillSelectorI18nKeys.NoMatchingSkillsLabel),
      },
    }),
    [t],
  );

  /*
   * The history chip renders beside the message bubble's first text line, so
   * its label uses the same type-scale step as that text — both steps share a
   * 24px line height, keeping the chip's height matched to the line.
   */
  const historyChipLabelClassName = isMobile
    ? 'dial-small-paragraph-text'
    : 'dial-body-text';

  return useHostAgnosticSkillSelectorOverlay({
    isEnabled,
    skills,
    sharedWithMe,
    publicSkills,
    favoriteIds,
    onToggleFavorite: handleToggleFavorite,
    fetchSkillDescription: handleFetchSkillDescription,
    labels,
    historyChipLabelClassName,
    renderCatalogContent,
    detailsPanelComponent: SkillDetailsPanelContainer,
  });
};
