import {
  buildCssVars,
  type DeploymentItem,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DropdownItem,
  ElementSize,
  Highlight,
  MenuItemMark,
  Search,
} from '@epam/ai-dial-ui-kit';
import { type ReactNode, useMemo, useState } from 'react';
import {
  MODEL_SELECTOR_SKELETON_ROW_COUNT,
  ModelSelectorSkeletonIcon,
  ModelSelectorSkeletonLabel,
} from '../components/ModelSelectorSkeleton/ModelSelectorSkeleton';
import type { ModelSelectorLabels } from '../models/Input';
import {
  buildDeploymentIcon,
  filterDeployments,
  getDeploymentLabel,
} from '../utils/deployment';
import styles from './useModelSelector.module.scss';

/** Options passed to `useModelSelector`. */
export interface UseModelSelectorOptions {
  /** Available deployment items. When `undefined`, the selector is hidden. `iconUrl` must already be resolved by the host app. */
  deployments?: DeploymentItem[];
  /** Currently selected deployment ID. */
  selectedDeploymentId?: string | null;
  /** Called when the user picks a different deployment. */
  onDeploymentChange?: (id: string) => void;
  /** Status labels for the selector dropdown. */
  modelSelectorLabels?: ModelSelectorLabels;
  /** Class applied to the sticky search header wrapper for theming. Defaults to a `--bg-layer-raised` background. */
  searchHeaderClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: ModelSelectorColors;
}

/** Color overrides for the model-selector menu, applied as CSS custom properties. */
export interface ModelSelectorColors {
  /** Sticky search header background. Fallback: `--bg-layer-raised`. */
  searchHeaderBackground?: string;
}

/** Values returned by `useModelSelector`. */
export interface UseModelSelectorResult {
  /** Icon node for the trigger button. */
  selectorIcon: ReactNode;
  /** Accessible label for the trigger button. */
  selectorAriaLabel: string;
  /** Display name of the currently selected deployment, or `undefined` when none is selected or loading. */
  selectedLabel: string | undefined;
  /** Display version of the currently selected deployment, or `undefined` when none is selected, loading, or the deployment has no version. */
  selectedVersion: string | undefined;
  /** Menu items for the deployment dropdown. */
  menuItems: DropdownItem[];
  /** Sticky search header rendered above the menu items. */
  menuHeader: ReactNode;
  /** Should be passed to `DialDropdownIcon.onOpenChange` to reset the search on close. */
  onOpenChange: (isOpen: boolean) => void;
}

/** Encapsulates model selector state, filtering, and menu construction. */
export const useModelSelector = ({
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  modelSelectorLabels,
  searchHeaderClassName = styles.searchHeader,
  colors,
}: UseModelSelectorOptions): UseModelSelectorResult => {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = useMemo(
    () => deployments?.find((i) => i.id === selectedDeploymentId),
    [deployments, selectedDeploymentId],
  );
  const isLoading = modelSelectorLabels?.loading !== undefined;

  const isSelectedDeploymentUnavailable =
    !isLoading && !selectedItem && !!selectedDeploymentId;

  const selectorIcon: ReactNode = useMemo(
    () =>
      isLoading ? (
        <ModelSelectorSkeletonIcon size={DIAL_ICON_SIZE.LG} />
      ) : (
        buildDeploymentIcon(
          selectedItem?.iconUrl,
          selectedItem?.type,
          selectedItem?.displayName ?? selectedItem?.id ?? '',
          DIAL_ICON_SIZE.LG,
          isSelectedDeploymentUnavailable
            ? (modelSelectorLabels?.unavailableTooltip ??
                'This deployment is no longer available')
            : undefined,
        )
      ),
    [
      isLoading,
      selectedItem,
      isSelectedDeploymentUnavailable,
      modelSelectorLabels?.unavailableTooltip,
    ],
  );

  const selectedLabel = selectedItem?.displayName ?? selectedItem?.id;
  const selectedVersion = selectedItem?.displayVersion;
  const selectorAriaLabel = selectedLabel
    ? `${modelSelectorLabels?.ariaLabel ?? 'Select model'}: ${selectedLabel}`
    : (modelSelectorLabels?.ariaLabel ?? 'Select model');

  const menuItems: DropdownItem[] = useMemo(() => {
    if (isLoading) {
      return Array.from(
        { length: MODEL_SELECTOR_SKELETON_ROW_COUNT },
        (_, index) => ({
          key: `__loading-${index}`,
          icon: <ModelSelectorSkeletonIcon />,
          label: (
            <ModelSelectorSkeletonLabel
              loadingLabel={
                index === 0 ? modelSelectorLabels?.loading : undefined
              }
            />
          ),
          disabled: true,
        }),
      );
    }

    if (!deployments || deployments.length === 0) {
      const stateLabel =
        modelSelectorLabels?.error ?? modelSelectorLabels?.empty;
      if (stateLabel) {
        return [{ key: '__state', label: stateLabel, disabled: true }];
      }
      return [];
    }
    return filterDeployments(deployments, searchQuery).map((item) => ({
      key: item.id,
      label: (
        <Highlight
          text={getDeploymentLabel(item)}
          query={searchQuery}
          maxLines={1}
        />
      ),
      icon: buildDeploymentIcon(
        item.iconUrl,
        item.type,
        item.displayName ?? item.id,
      ),
      /* The picked deployment is the menu's single choice, so the kit draws the
         trailing check and announces the row as a radio item. */
      mark: MenuItemMark.Check,
      checked: item.id === selectedDeploymentId,
      onClick: () => onDeploymentChange?.(item.id),
    }));
  }, [
    deployments,
    isLoading,
    searchQuery,
    selectedDeploymentId,
    modelSelectorLabels,
    onDeploymentChange,
  ]);

  const menuHeader: ReactNode = useMemo(
    () =>
      !isLoading && deployments && deployments.length > 0 ? (
        <div
          style={buildCssVars({
            '--ms-search-header-bg': colors?.searchHeaderBackground,
          })}
          className={mergeClasses(
            'sticky top-0 z-10 pb-1 pe-2 pt-2',
            searchHeaderClassName,
          )}
        >
          <Search
            value={searchQuery}
            placeholder={modelSelectorLabels?.searchPlaceholder ?? 'Search'}
            size={ElementSize.Small}
            wrapperClassName="border-0"
            onChange={(value) => setSearchQuery(value ?? '')}
          />
        </div>
      ) : undefined,
    [
      deployments,
      isLoading,
      searchQuery,
      modelSelectorLabels,
      searchHeaderClassName,
      colors?.searchHeaderBackground,
    ],
  );

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setSearchQuery('');
  };

  return {
    selectorIcon,
    selectorAriaLabel,
    selectedLabel,
    selectedVersion,
    menuItems,
    menuHeader,
    onOpenChange: handleOpenChange,
  };
};
