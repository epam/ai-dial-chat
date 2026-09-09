import type {
  FavoriteSkillItem,
  FavoriteSkillsPanelLabels,
} from '@epam/ai-dial-skills';
import { lazy, memo, Suspense, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  FavoritesI18nKeys,
  PromptSelectorI18nKeys,
  SkillSelectorI18nKeys,
} from '../../constants/translation-keys';

const FavoriteSkillsPanel = lazy(async () => {
  const module = await import('@epam/ai-dial-skills');
  return { default: module.FavoriteSkillsPanel };
});

interface Props {
  favorites: FavoriteSkillItem[];
  onSelect: (item: FavoriteSkillItem) => void;
  onToggleFavorite: (id: string) => void;
  onBrowse: () => void;
  onViewDetails: (item: FavoriteSkillItem) => void;
  onItemTooltipOpen?: (id: string) => void;
}

/** Wires app i18n labels into the lib's `FavoriteSkillsPanel`. */
const SkillSelectorOverlay: FC<Props> = ({
  favorites,
  onSelect,
  onToggleFavorite,
  onBrowse,
  onViewDetails,
  onItemTooltipOpen,
}) => {
  const { t } = useTranslation();

  /*
   * "My Collection" reuses the prompt selector's key: it is the only
   * feature-scoped key carrying that exact value, and the panel's wording is
   * shared across every "selected list" overlay, not prompt-specific.
   */
  const labels: FavoriteSkillsPanelLabels = {
    myCollectionLabel: t(PromptSelectorI18nKeys.MyCollectionLabel),
    emptyHintLabel: t(SkillSelectorI18nKeys.EmptyHint),
    browseLabel: t(ButtonsI18nKeys.Browse),
    removeFromFavoritesLabel: t(FavoritesI18nKeys.RemoveFromFavorites),
    viewDetailsLabel: t(SkillSelectorI18nKeys.ViewDetailsLabel),
  };

  return (
    <Suspense fallback={null}>
      <FavoriteSkillsPanel
        favorites={favorites}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        onBrowse={onBrowse}
        onViewDetails={onViewDetails}
        onItemTooltipOpen={onItemTooltipOpen}
        labels={labels}
      />
    </Suspense>
  );
};

export default memo(SkillSelectorOverlay);
