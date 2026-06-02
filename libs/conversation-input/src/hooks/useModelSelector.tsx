import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialSearch, ElementSize } from '@epam/ai-dial-ui-kit';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import { IconApps, IconRobot } from '@tabler/icons-react';
import { type ReactNode, useState } from 'react';
import { DeploymentIcon } from '../components/Input/DeploymentIcon.js';
import type { ModelSelectorLabels } from '../models/Input.js';

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

const buildDeploymentIcon = (
  iconUrl: string | undefined,
  type: string | undefined,
): ReactNode => {
  if (iconUrl) {
    return (
      <DeploymentIcon
        src={iconUrl}
        size={DIAL_ICON_SIZE.SM}
        fallback={
          type === 'application' ? (
            <IconApps size={DIAL_ICON_SIZE.SM} aria-hidden />
          ) : (
            <IconRobot size={DIAL_ICON_SIZE.SM} aria-hidden />
          )
        }
      />
    );
  }
  return type === 'application' ? (
    <IconApps size={DIAL_ICON_SIZE.SM} aria-hidden />
  ) : (
    <IconRobot size={DIAL_ICON_SIZE.SM} aria-hidden />
  );
};

/** Encapsulates model selector state, filtering, and menu construction. */
export const useModelSelector = ({
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  modelSelectorLabels,
}: UseModelSelectorOptions): UseModelSelectorResult => {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = deployments?.find((i) => i.id === selectedDeploymentId);

  let selectorIcon: ReactNode;
  if (selectedItem?.iconUrl) {
    const fallback =
      selectedItem.type === 'application' ? (
        <IconApps size={18} aria-hidden />
      ) : (
        <IconRobot size={18} aria-hidden />
      );
    selectorIcon = (
      <DeploymentIcon
        src={selectedItem.iconUrl}
        size={18}
        fallback={fallback}
      />
    );
  } else if (selectedItem?.type === 'application') {
    selectorIcon = <IconApps size={18} aria-hidden />;
  } else {
    selectorIcon = <IconRobot size={18} aria-hidden />;
  }

  const selectedLabel = selectedItem?.displayName ?? selectedItem?.id;
  const selectorAriaLabel = selectedLabel
    ? `${modelSelectorLabels?.ariaLabel ?? 'Select model'}: ${selectedLabel}`
    : (modelSelectorLabels?.ariaLabel ?? 'Select model');

  const buildMenuItems = (): DropdownItem[] => {
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
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? deployments.filter((item) =>
          (item.displayName ?? item.id).toLowerCase().includes(query),
        )
      : deployments;
    return filtered.map((item) => ({
      key: item.id,
      label: item.displayName ?? item.id,
      icon: buildDeploymentIcon(item.iconUrl, item.type),
      onClick: () => onDeploymentChange?.(item.id),
    }));
  };

  const menuHeader: ReactNode =
    deployments && deployments.length > 0 ? (
      <div className="sticky top-0 z-10 bg-layer-0 px-2 pb-1 pt-2">
        <DialSearch
          value={searchQuery}
          placeholder="Search"
          size={ElementSize.Small}
          onChange={setSearchQuery}
        />
      </div>
    ) : undefined;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setSearchQuery('');
  };

  return {
    selectorIcon,
    selectorAriaLabel,
    menuItems: buildMenuItems(),
    menuHeader,
    onOpenChange: handleOpenChange,
  };
};
