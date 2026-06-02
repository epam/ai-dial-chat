import { type DeploymentItem, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialSearch, ElementSize } from '@epam/ai-dial-ui-kit';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import { IconRobot } from '@tabler/icons-react';
import { type ReactNode, useMemo, useState } from 'react';
import { DeploymentIcon } from '../components/Input/DeploymentIcon.js';
import type { ModelSelectorLabels } from '../models/Input.js';
import {
  buildDeploymentIcon,
  filterDeployments,
  getDeploymentLabel,
} from '../utils/deployment.js';

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
  /** CSS class applied to the sticky search header wrapper. Defaults to `'bg-layer-0'`. */
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
      selectedItem?.iconUrl ? (
        <DeploymentIcon
          src={selectedItem.iconUrl}
          size={18}
          fallback={<IconRobot size={18} aria-hidden />}
        />
      ) : (
        <IconRobot size={18} aria-hidden />
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
    }));
  }, [deployments, searchQuery, modelSelectorLabels, onDeploymentChange]);

  const menuHeader: ReactNode = useMemo(
    () =>
      deployments && deployments.length > 0 ? (
        <div
          className={mergeClasses(
            'sticky top-0 z-10 px-2 pb-1 pt-2',
            searchHeaderClassName,
          )}
        >
          <DialSearch
            value={searchQuery}
            placeholder={modelSelectorLabels?.searchPlaceholder ?? 'Search'}
            size={ElementSize.Small}
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
