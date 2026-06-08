import { type DeploymentItem, mergeClasses } from '@epam/ai-dial-chat-shared';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import { DIAL_ICON_SIZE, DialSearch, ElementSize } from '@epam/ai-dial-ui-kit';
import { type ReactNode, useMemo, useState } from 'react';
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
  /** Class applied to the sticky search header wrapper for theming. Defaults to `'bg-layer-0'`. */
  searchHeaderClassName?: string;
}

/** Values returned by `useModelSelector`. */
export interface UseModelSelectorResult {
  /** Icon node for the trigger button. */
  selectorIcon: ReactNode;
  /** Accessible label for the trigger button. */
  selectorAriaLabel: string;
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
  searchHeaderClassName = 'bg-layer-0',
}: UseModelSelectorOptions): UseModelSelectorResult => {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = useMemo(
    () => deployments?.find((i) => i.id === selectedDeploymentId),
    [deployments, selectedDeploymentId],
  );

  const selectorIcon: ReactNode = useMemo(
    () =>
      buildDeploymentIcon(
        selectedItem?.iconUrl,
        selectedItem?.type,
        DIAL_ICON_SIZE.LG,
      ),
    [selectedItem],
  );

  const selectedLabel = selectedItem?.displayName ?? selectedItem?.id;
  const selectorAriaLabel = selectedLabel
    ? `${modelSelectorLabels?.ariaLabel ?? 'Select model'}: ${selectedLabel}`
    : (modelSelectorLabels?.ariaLabel ?? 'Select model');

  const menuItems: DropdownItem[] = useMemo(() => {
    if (!deployments || deployments.length === 0) {
      const stateLabel =
        modelSelectorLabels?.loading ??
        modelSelectorLabels?.error ??
        modelSelectorLabels?.empty;
      if (stateLabel) {
        return [{ key: '__state', label: stateLabel, disabled: true }];
      }
      return [];
    }
    return filterDeployments(deployments, searchQuery).map((item) => ({
      key: item.id,
      label: getDeploymentLabel(item),
      icon: buildDeploymentIcon(item.iconUrl, item.type),
      onClick: () => onDeploymentChange?.(item.id),
      className:
        item.id === selectedDeploymentId
          ? 'bg-accent-primary-alpha'
          : undefined,
    }));
  }, [deployments, searchQuery, modelSelectorLabels, onDeploymentChange]);

  const menuHeader: ReactNode = useMemo(
    () =>
      deployments && deployments.length > 0 ? (
        <div
          className={mergeClasses(
            'sticky top-0 z-10 pb-1 pr-2 pt-2',
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
    [deployments, searchQuery, modelSelectorLabels, searchHeaderClassName],
  );

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setSearchQuery('');
  };

  return {
    selectorIcon,
    selectorAriaLabel,
    menuItems,
    menuHeader,
    onOpenChange: handleOpenChange,
  };
};
