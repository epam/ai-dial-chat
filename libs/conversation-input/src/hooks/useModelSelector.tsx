import {
  buildCssVars,
  type DeploymentItem,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DropdownItem,
  DropdownItemType,
  ElementSize,
  Highlight,
  MenuItemMark,
  Search,
  useSkeletonTiming,
} from '@epam/ai-dial-ui-kit';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ModelSelectorSkeletonIcon,
  ModelSelectorSkeletonRows,
} from '../components/ModelSelectorSkeleton/ModelSelectorSkeleton';
import { CONVERSATION_INPUT_CLASS } from '../constants/public-class-names';
import type { ModelMenuStyles, ModelSelectorLabels } from '../models/Input';
import {
  buildDeploymentIcon,
  filterDeployments,
  getDeploymentLabel,
} from '../utils/deployment';
import styles from './useModelSelector.module.scss';

/* Length of the kit's content fade-in (`--animate-skeleton-reveal`, 180 ms). */
const REVEAL_DURATION_MS = 180;

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
  /** Host styling hooks for the search header and deployment rows. Each class is merged after the default, never in place of it. */
  styles?: ModelMenuStyles;
}

/** Values returned by `useModelSelector`. */
export interface UseModelSelectorResult {
  /** Shared query retained while a selector changes presentation. */
  searchQuery: string;
  /** Updates the shared phone/desktop search query. */
  onSearchQueryChange: (query: string) => void;
  /** Icon node for the trigger button. */
  selectorIcon: ReactNode;
  /** Accessible label for the trigger button. */
  selectorAriaLabel: string;
  /** Trigger tooltip shown when the selected deployment is no longer available, or `undefined` otherwise. Defaults to `'This deployment is no longer available'` when `modelSelectorLabels.unavailableTooltip` is unset. */
  unavailableTooltip: string | undefined;
  /** Display name of the currently selected deployment, or `undefined` when none is selected or loading. */
  selectedLabel: string | undefined;
  /** Display version of the currently selected deployment, or `undefined` when none is selected, loading, or the deployment has no version. */
  selectedVersion: string | undefined;
  /** Loading text for a status region that is always mounted beside the dropdown: set while the skeleton is drawn, empty otherwise, so a fast load is never announced. */
  loadingAnnouncement: string;
  /** Menu items for the deployment dropdown. */
  menuItems: DropdownItem[];
  /** Sticky search header rendered above the menu items. */
  menuHeader: ReactNode;
  /** Custom properties carrying the host's row colours; pass to `Dropdown.listStyle`. */
  menuStyle: CSSProperties;
  /** Should be passed to `DialDropdownIcon.onOpenChange` to reset the search on close. */
  onOpenChange: (isOpen: boolean) => void;
}

/** Encapsulates model selector state, filtering, and menu construction. */
export const useModelSelector = ({
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  modelSelectorLabels,
  styles: menuStyles,
}: UseModelSelectorOptions): UseModelSelectorResult => {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = useMemo(
    () => deployments?.find((i) => i.id === selectedDeploymentId),
    [deployments, selectedDeploymentId],
  );
  const isLoading = modelSelectorLabels?.loading !== undefined;
  const {
    showPlaceholder,
    showSkeleton,
    placeholderClassName,
    contentClassName,
  } = useSkeletonTiming(isLoading);

  /* The kit keeps `contentClassName` set until the next load, but the menu
     remounts its items on every open and on every search filter, so the 180 ms
     fade would replay each time. It is dropped once it has played. */
  const [hasRevealPlayed, setHasRevealPlayed] = useState(false);
  useEffect(() => {
    if (!contentClassName) {
      setHasRevealPlayed(false);
      return undefined;
    }
    const timer = setTimeout(
      () => setHasRevealPlayed(true),
      REVEAL_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [contentClassName]);
  const itemRevealClassName = hasRevealPlayed ? '' : contentClassName;

  /* Loading, then the skeleton's minimum display time, defers every resolved
     state: an unloaded list is unknown, not unavailable or empty. */
  const isSelectedDeploymentUnavailable =
    !showPlaceholder && !selectedItem && !!selectedDeploymentId;

  /* The icon sits inside the trigger button, whose own tooltip owns hover and
   * focus, so a tooltip on the icon would never open. The unavailable notice
   * travels to the button instead (`unavailableTooltip`). */
  const selectorIcon: ReactNode = useMemo(
    () =>
      showPlaceholder ? (
        <ModelSelectorSkeletonIcon
          size={DIAL_ICON_SIZE.LG}
          className={placeholderClassName}
        />
      ) : (
        buildDeploymentIcon(
          selectedItem?.iconUrl,
          selectedItem?.type,
          selectedItem?.displayName ?? selectedItem?.id ?? '',
          DIAL_ICON_SIZE.LG,
        )
      ),
    [showPlaceholder, placeholderClassName, selectedItem],
  );

  const selectedLabel = selectedItem?.displayName ?? selectedItem?.id;
  const selectedVersion = selectedItem?.displayVersion;
  const unavailableTooltip = isSelectedDeploymentUnavailable
    ? (modelSelectorLabels?.unavailableTooltip ??
      'This deployment is no longer available')
    : undefined;
  const selectorAriaLabel = selectedLabel
    ? `${modelSelectorLabels?.ariaLabel ?? 'Select model'}: ${selectedLabel}`
    : (modelSelectorLabels?.ariaLabel ?? 'Select model');

  const menuItems: DropdownItem[] = useMemo(() => {
    if (showPlaceholder) {
      /* One plain-text item holds the whole shimmer block: a regular item is a
       * fixed-height, truncating button, and a shimmer per item would run one
       * wave per row. The loading text is announced by the status region
       * `loadingAnnouncement` feeds, not from inside the menu. */
      return [
        {
          key: '__loading',
          type: DropdownItemType.PlainText,
          className: 'p-0!',
          label: <ModelSelectorSkeletonRows className={placeholderClassName} />,
        },
      ];
    }

    if (!deployments || deployments.length === 0) {
      const stateLabel =
        modelSelectorLabels?.error ?? modelSelectorLabels?.empty;
      if (stateLabel) {
        return [{ key: '__state', label: stateLabel, disabled: true }];
      }
      return [];
    }
    const colors = menuStyles?.colors;
    return filterDeployments(deployments, searchQuery).map((item) => {
      const isSelected = item.id === selectedDeploymentId;
      return {
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
        /* The picked deployment is the menu's single choice, so the kit draws
           the trailing check and announces the row as a radio item. */
        mark: MenuItemMark.Check,
        checked: isSelected,
        className: mergeClasses(
          colors?.itemText && styles.itemText,
          colors?.itemHoverBackground && styles.itemHover,
          isSelected &&
            colors?.selectedItemBackground &&
            styles.selectedItemBackground,
          isSelected && colors?.selectedItemText && styles.selectedItemText,
          isSelected && colors?.checkIcon && styles.checkIcon,
          menuStyles?.itemClassName,
          isSelected && menuStyles?.selectedItemClassName,
          CONVERSATION_INPUT_CLASS.modelMenuItem,
          isSelected && CONVERSATION_INPUT_CLASS.modelMenuItemSelected,
          itemRevealClassName,
        ),
        onClick: () => onDeploymentChange?.(item.id),
      };
    });
  }, [
    deployments,
    showPlaceholder,
    placeholderClassName,
    itemRevealClassName,
    searchQuery,
    selectedDeploymentId,
    modelSelectorLabels,
    onDeploymentChange,
    menuStyles?.itemClassName,
    menuStyles?.selectedItemClassName,
    menuStyles?.colors,
  ]);

  /*
   * The dropdown panel renders in a portal, so the row colours travel as
   * custom properties on the panel itself rather than on the composer.
   */
  const menuStyle = useMemo(
    () =>
      buildCssVars({
        '--ms-item-text': menuStyles?.colors?.itemText,
        '--ms-item-hover-bg': menuStyles?.colors?.itemHoverBackground,
        '--ms-selected-item-bg': menuStyles?.colors?.selectedItemBackground,
        '--ms-selected-item-text': menuStyles?.colors?.selectedItemText,
        '--ms-check-icon': menuStyles?.colors?.checkIcon,
      }),
    [menuStyles?.colors],
  );

  const menuHeader: ReactNode = useMemo(
    () =>
      !showPlaceholder && deployments && deployments.length > 0 ? (
        <div
          style={buildCssVars({
            '--ms-search-header-bg': menuStyles?.colors?.searchHeaderBackground,
          })}
          className={mergeClasses(
            'sticky top-0 z-10 pe-2 pt-2 pb-1',
            styles.searchHeader,
            menuStyles?.searchHeaderClassName,
            CONVERSATION_INPUT_CLASS.modelMenuSearch,
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
      showPlaceholder,
      searchQuery,
      modelSelectorLabels,
      menuStyles?.searchHeaderClassName,
      menuStyles?.colors?.searchHeaderBackground,
    ],
  );

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setSearchQuery('');
  };

  return {
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    selectorIcon,
    selectorAriaLabel,
    unavailableTooltip,
    selectedLabel,
    selectedVersion,
    loadingAnnouncement: showSkeleton
      ? (modelSelectorLabels?.loading ?? '')
      : '',
    menuItems,
    menuHeader,
    menuStyle,
    onOpenChange: handleOpenChange,
  };
};
