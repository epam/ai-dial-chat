import { FavoriteEntityType } from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import {
  getSkillFallbackName,
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

/** {@link UseSkillSelectorOverlayResult} plus an app-level convenience for the route-driven one-shot skill selection (the catalog's "Use in chat" action), which only has a URL and no caret position to work from. */
export interface AppSkillSelectorOverlayResult extends UseSkillSelectorOverlayResult {
  /**
   * Seeds the composer's draft with a single mention for `url`, resolving its
   * display name from the loaded skill listings (falling back to the url's
   * last segment). For a one-shot selection that has no caret position and no
   * `SkillListingEntry` in hand — e.g. a catalog "Use in chat" action or a
   * route-state deep link — unlike `insertMention`-backed flows, which always
   * have both.
   */
  selectSkillByUrl: (url: string) => void;
}

/**
 * Host wiring for the lib's skill selector overlay hook: the
 * `skillUsageEnabled` feature flag, the deployment's skills support signal,
 * the skills and favorites contexts, i18n labels, the catalog picker
 * content, and the app-owned details panel component.
 */
export const useSkillSelectorOverlay = ({
  isSkillsSupported,
}: {
  /** Whether the input's current deployment supports skills (`features.skillsSupported === true`). */
  isSkillsSupported: boolean;
}): AppSkillSelectorOverlayResult => {
  const isEnabled = useFeatureFlag('skillUsageEnabled');
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();

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
    ? 'dial-small-paragraph-text text-accent'
    : 'dial-body-text text-accent';

  const overlay = useHostAgnosticSkillSelectorOverlay({
    isEnabled,
    isSkillsSupported,
    skills,
    sharedWithMe,
    publicSkills,
    favoriteIds,
    onToggleFavorite: handleToggleFavorite,
    labels,
    historyChipLabelClassName,
    renderCatalogContent,
    detailsPanelComponent: SkillDetailsPanelContainer,
  });

  const { seedSkillMentions } = overlay;

  /*
   * `allSkills`/name resolution mirrors the lib hook's own internal
   * `skillByUrl` lookup — duplicated here (not exported by the lib) because
   * this is the one call site with a URL but no `SkillListingEntry` in hand.
   */
  const selectSkillByUrl = useCallback(
    (url: string) => {
      const allSkills = [
        ...skills,
        ...(sharedWithMe ?? []),
        ...(publicSkills ?? []),
      ];
      const name =
        allSkills.find((skill) => skill.url === url)?.name ??
        getSkillFallbackName(url);
      seedSkillMentions(`/${name} `, [{ url }]);
    },
    [skills, sharedWithMe, publicSkills, seedSkillMentions],
  );

  return { ...overlay, selectSkillByUrl };
};
