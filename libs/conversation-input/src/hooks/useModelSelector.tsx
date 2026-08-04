import { type DeploymentItem, mergeClasses } from '@epam/ai-dial-chat-shared';
import { GradientCheckIcon } from '@epam/ai-dial-kit';
import {
  DIAL_ICON_SIZE,
  DialSearch,
  DropdownItem,
  ElementSize,
  Highlight,
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
  /** Class applied to the sticky search header wrapper for theming. Defaults to `'bg-layer-raised'`. */
  searchHeaderClassName?: string;
}

/** Values returned by `useModelSelector`. */
export interface UseModelSelectorResult {
  /** Icon node for the trigger button. */
  selectorIcon: ReactNode;
  /** Accessible label for the trigger button. */
  selectorAriaLabel: string;
  /** Display name of the currently selected deployment, or `undefined` when none is selected or loading. */
  selectedLabel: string | undefined;
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
  searchHeaderClassName = 'bg-layer-raised',
}: UseModelSelectorOptions): UseModelSelectorResult => {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = useMemo(
    () => deployments?.find((i) => i.id === selectedDeploymentId),
    [deployments, selectedDeploymentId],
  );
  const isLoading = modelSelectorLabels?.loading !== undefined;

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
        )
      ),
    [isLoading, selectedItem],
  );

  const selectedLabel = selectedItem?.displayName ?? selectedItem?.id;
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
    return filterDeployments(deployments, searchQuery).map((item) => {
      const isSelected = item.id === selectedDeploymentId;
      return {
        key: item.id,
        label: (
          <span className="flex w-full items-center justify-between gap-2">
            <Highlight
              text={getDeploymentLabel(item)}
              query={searchQuery}
              maxLines={1}
            />
            {isSelected && <GradientCheckIcon gradientId="ms-check-grad" />}
          </span>
        ),
        icon: buildDeploymentIcon(
          item.iconUrl,
          item.type,
          item.displayName ?? item.id,
        ),
        onClick: () => onDeploymentChange?.(item.id),
        className: isSelected ? 'bg-accent-primary-alpha' : undefined,
      };
    });
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
          className={mergeClasses(
            'sticky top-0 z-10 pb-1 pe-2 pt-2',
            searchHeaderClassName,
          )}
        >
          <DialSearch
            value={searchQuery}
            placeholder={modelSelectorLabels?.searchPlaceholder ?? 'Search'}
            size={ElementSize.Small}
            wrapperClassName="border-0"
            onChange={setSearchQuery}
          />
        </div>
      ) : undefined,
    [
      deployments,
      isLoading,
      searchQuery,
      modelSelectorLabels,
      searchHeaderClassName,
    ],
  );

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setSearchQuery('');
  };

  return {
    selectorIcon,
    selectorAriaLabel,
    selectedLabel,
    menuItems,
    menuHeader,
    onOpenChange: handleOpenChange,
  };
};
