import { DialSearch, ElementSize } from '@epam/ai-dial-ui-kit';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import type { DeploymentItemDto } from '@epam/chat-api-client';
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
  /** Available deployment items. When `undefined`, the selector is hidden. */
  deployments?: DeploymentItemDto[];
  /** Currently selected deployment ID. */
  selectedDeploymentId?: string | null;
  /** Called when the user picks a different deployment. */
  onDeploymentChange?: (id: string) => void;
  /** Status labels for the selector dropdown. */
  modelSelectorLabels?: ModelSelectorLabels;
  /** Resolves a raw `iconUrl` value to a usable `<img src>` URL. */
  resolveDeploymentIconUrl: (iconUrl: string) => string | undefined;
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
  resolveDeploymentIconUrl,
}: UseModelSelectorOptions): UseModelSelectorResult => {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = useMemo(
    () => deployments?.find((i) => i.id === selectedDeploymentId),
    [deployments, selectedDeploymentId],
  );
  const selectedIconUrl = selectedItem?.iconUrl
    ? resolveDeploymentIconUrl(selectedItem.iconUrl)
    : undefined;

  const selectorIcon: ReactNode = useMemo(
    () =>
      selectedIconUrl ? (
        <DeploymentIcon
          src={selectedIconUrl}
          size={18}
          fallback={<IconRobot size={18} aria-hidden />}
        />
      ) : (
        <IconRobot size={18} aria-hidden />
      ),
    [selectedIconUrl],
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
    return filterDeployments(deployments, searchQuery).map((item) => {
      const itemIconUrl = item.iconUrl
        ? resolveDeploymentIconUrl(item.iconUrl)
        : undefined;
      return {
        key: item.id,
        label: getDeploymentLabel(item),
        icon: buildDeploymentIcon(itemIconUrl, item.type),
        onClick: () => onDeploymentChange?.(item.id),
      };
    });
  }, [
    deployments,
    searchQuery,
    modelSelectorLabels,
    resolveDeploymentIconUrl,
    onDeploymentChange,
  ]);

  const menuHeader: ReactNode = useMemo(
    () =>
      deployments && deployments.length > 0 ? (
        <div className="sticky top-0 z-10 bg-layer-0 px-2 pb-1 pt-2">
          <DialSearch
            value={searchQuery}
            placeholder="Search"
            size={ElementSize.Small}
            onChange={setSearchQuery}
          />
        </div>
      ) : undefined,
    [deployments, searchQuery],
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
