import {
  buildCssVars,
  type DeploymentItem,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  Button,
  DIAL_ICON_SIZE,
  DialSearch,
  ElementSize,
  Highlight,
} from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import { type CSSProperties, type FC, useEffect, useState } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { buildDeploymentIcon, filterDeployments } from '../../utils/deployment';
import type { BottomSheetShellColors } from '../BottomSheetShell/BottomSheetShell';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import { ModelSelectorSkeletonRows } from '../ModelSelectorSkeleton/ModelSelectorSkeleton';
import styles from './ModelSelectorBottomSheet.module.scss';

/** Color overrides for the `ModelSelectorBottomSheet` component, applied as CSS custom properties. */
export interface ModelSelectorBottomSheetColors {
  /** Divider color between the search field and the deployment list. Defaults to `--bg-layer-4`. */
  divider?: string;
  /** Item label and state-label text color. Defaults to `--text-primary`/`--text-secondary`. */
  itemText?: string;
  /** Item hover background. Defaults to `--bg-layer-raised`. */
  itemHoverBg?: string;
  /** Item active/pressed background. Defaults to `--bg-layer-4`. */
  itemActiveBg?: string;
  /** Item leading-icon color. Defaults to `--text-secondary`. */
  itemIcon?: string;
  /** Selected-row checkmark icon color. Defaults to `--text-accent-primary`. */
  checkIcon?: string;
  /** Color overrides forwarded to the underlying `BottomSheetShell` (backdrop, panel background, title, divider). */
  shell?: BottomSheetShellColors;
}

/** Fixed pixel height of a single deployment row, used by the virtualized list. */
const ROW_HEIGHT = 44;
/** Maximum number of rows shown before the list becomes scrollable. */
const MAX_VISIBLE_ROWS = 8;

/** Data passed to each virtualized row via react-window's `rowProps`. */
interface ModelRowData {
  /** The deployments currently rendered (already filtered). */
  items: DeploymentItem[];
  /** ID of the currently selected deployment, shown with a checkmark. */
  selectedDeploymentId?: string | null;
  /** Typography class applied to the item label. */
  labelClassName: string;
  /** Current search query — used to highlight matches in item labels. */
  query: string;
  /** Invoked when a row is tapped. */
  onSelect: (id: string) => void;
}

/** Renders a single deployment row inside the virtualized list. */
const ModelRow = ({
  index,
  style,
  ariaAttributes,
  items,
  selectedDeploymentId,
  labelClassName,
  query,
  onSelect,
}: RowComponentProps<ModelRowData>) => {
  const item = items[index];
  const modelIcon = buildDeploymentIcon(
    item.iconUrl,
    item.type,
    item.displayName ?? item.id,
    DIAL_ICON_SIZE.SM,
  );
  const isSelected = item.id === selectedDeploymentId;

  return (
    <div style={style} {...ariaAttributes}>
      <Button
        type="button"
        className={mergeClasses(styles.item, 'h-full w-full gap-3 px-4')}
        iconBefore={<span className={styles.itemIcon}>{modelIcon}</span>}
        label={
          <span className="flex flex-1 items-center justify-between gap-2">
            <Highlight
              text={item.displayName ?? item.id}
              query={query}
              maxLines={1}
              className={mergeClasses(
                labelClassName,
                'min-w-0 flex-1 text-start',
              )}
            />
            {isSelected && (
              <IconCheck
                size={DIAL_ICON_SIZE.SM}
                className={styles.checkIcon}
                aria-hidden
              />
            )}
          </span>
        }
        onClick={() => onSelect(item.id)}
      />
    </div>
  );
};

/** Props for the mobile bottom-sheet model selector. */
export interface ModelSelectorBottomSheetProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /** Title displayed in the sheet header and used as the dialog accessible name. */
  title: string;
  /** Accessible label for the close (×) button. */
  closeLabel: string;
  /** Placeholder text for the search input. Defaults to `'Search'`. */
  searchPlaceholder?: string;
  /** Called when the sheet should close (backdrop tap, close button, or Escape). */
  onClose: () => void;
  /** Full list of deployments to display. When `undefined` or empty, a state label is shown. `iconUrl` must already be resolved by the host app. */
  deployments?: DeploymentItem[];
  /** ID of the currently selected deployment. Shown with a checkmark. */
  selectedDeploymentId?: string | null;
  /** Called when the user taps a deployment; the sheet closes automatically after. */
  onSelect: (id: string) => void;
  /** Label shown as a disabled item while deployments are loading. */
  loadingLabel?: string;
  /** Label shown as a disabled item when the deployments fetch failed. */
  errorLabel?: string;
  /** Label shown as a disabled item when the deployments list is empty. */
  emptyLabel?: string;
  /** Inline CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
  /** CSS class applied to the sheet title. Defaults to `'dial-body-semi-bold-text'`. */
  titleClassName?: string;
  /** CSS class applied to each item label and the state label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: ModelSelectorBottomSheetColors;
}

/** Mobile bottom-sheet model selector with search and a virtualized deployment list. */
export const ModelSelectorBottomSheet: FC<ModelSelectorBottomSheetProps> = ({
  isOpen,
  title,
  closeLabel,
  searchPlaceholder = 'Search',
  onClose,
  deployments,
  selectedDeploymentId,
  onSelect,
  loadingLabel,
  errorLabel,
  emptyLabel,
  style,
  titleClassName = 'dial-body-semi-text',
  labelClassName = 'dial-small-text',
  colors,
}) => {
  const [query, setQuery] = useState('');

  // Reset search query each time the sheet closes
  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  const hasDeployments = deployments && deployments.length > 0;
  const isLoading = loadingLabel !== undefined;

  const stateLabel =
    !hasDeployments && !isLoading ? (errorLabel ?? emptyLabel) : undefined;

  const filtered = hasDeployments ? filterDeployments(deployments, query) : [];

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  const cssVars = buildCssVars({
    '--ci-sheet-divider': colors?.divider,
    '--ci-sheet-text': colors?.itemText,
    '--ci-sheet-item-hover': colors?.itemHoverBg,
    '--ci-sheet-item-active': colors?.itemActiveBg,
    '--ci-sheet-icon': colors?.itemIcon,
    '--ci-check-icon': colors?.checkIcon,
  });

  return (
    <BottomSheetShell
      isOpen={isOpen}
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      style={style}
      titleClassName={titleClassName}
      className="max-h-[80dvh]"
      colors={colors?.shell}
    >
      <div className="contents" style={cssVars}>
        {/* Search */}
        {hasDeployments && !isLoading && (
          <>
            <div className="flex-shrink-0 px-4 py-[10px]">
              <DialSearch
                value={query}
                placeholder={searchPlaceholder}
                size={ElementSize.Standard}
                onChange={setQuery}
              />
            </div>
            <div
              className={mergeClasses(styles.divider, 'h-px flex-shrink-0')}
            />
          </>
        )}

        {/* List */}
        {isLoading ? (
          <ModelSelectorSkeletonRows loadingLabel={loadingLabel} />
        ) : stateLabel ? (
          <div
            role="list"
            className={mergeClasses(
              styles.stateLabel,
              labelClassName,
              'px-4 py-4',
            )}
          >
            {stateLabel}
          </div>
        ) : (
          <List<ModelRowData>
            role="list"
            className="overflow-y-auto"
            style={{
              height: Math.min(filtered.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT,
            }}
            rowComponent={ModelRow}
            rowCount={filtered.length}
            rowHeight={ROW_HEIGHT}
            rowProps={{
              items: filtered,
              selectedDeploymentId,
              labelClassName,
              query,
              onSelect: handleSelect,
            }}
          />
        )}
      </div>
    </BottomSheetShell>
  );
};
