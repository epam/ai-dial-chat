import type {
  FavoritePromptItem,
  FavoritePromptsPanelLabels,
} from '@epam/ai-dial-prompts';
import { lazy, memo, Suspense, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  FavoritesI18nKeys,
  NavigationI18nKeys,
  PromptSelectorI18nKeys,
} from '../../constants/translation-keys';

const FavoritePromptsPanel = lazy(async () => {
  const module = await import('@epam/ai-dial-prompts');
  return { default: module.FavoritePromptsPanel };
});

interface Props {
  favorites: FavoritePromptItem[];
  onSelect: (item: FavoritePromptItem) => void;
  onToggleFavorite: (id: string) => void;
  onBrowse: () => void;
  onBack?: () => void;
}

/** Wires app i18n labels into the lib's `FavoritePromptsPanel`. */
const PromptSelectorOverlay: FC<Props> = ({
  favorites,
  onSelect,
  onToggleFavorite,
  onBrowse,
  onBack,
}) => {
  const { t } = useTranslation();

  const labels: FavoritePromptsPanelLabels = {
    myCollectionLabel: t(PromptSelectorI18nKeys.MyCollectionLabel),
    emptyHintLabel: t(PromptSelectorI18nKeys.EmptyHint),
    browseLabel: t(ButtonsI18nKeys.Browse),
    removeFromFavoritesLabel: t(FavoritesI18nKeys.RemoveFromFavorites),
    backLabel: t(NavigationI18nKeys.Back),
  };

  return (
    <Suspense fallback={null}>
      <FavoritePromptsPanel
        favorites={favorites}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        onBrowse={onBrowse}
        onBack={onBack}
        labels={labels}
      />
    </Suspense>
  );
};

export default memo(PromptSelectorOverlay);
