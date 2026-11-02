import type { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { type FC, type ReactNode, useCallback, useMemo, useState } from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import type { CatalogLoadStatus } from '../../types/load-status';
import { CatalogSelectionMode } from '../../types/selection-mode';
import { applyCatalogSelection } from '../../utils/list-selection';
import {
  CatalogPickerModal,
  type CatalogPickerListProps,
  type CatalogPickerModalLabels,
} from '../CatalogPickerModal/CatalogPickerModal';

/** User-visible strings of `AddOnCatalogModal`; pass translated ones in a localised host. */
export interface AddOnCatalogModalLabels extends CatalogPickerModalLabels {
  /** Accessible name of the select-all checkbox. Defaults to `'Select all'`. */
  selectAll?: string;
  /** Accessible name of a row's checkbox. Defaults to `` `Select ${name}` ``. */
  selectRow?: (name: string) => string;
}

/** `ListView` props `AddOnCatalogModal` passes through: all but those it sets for multiple selection. */
export type AddOnCatalogListProps = Omit<
  CatalogPickerListProps,
  | 'type'
  | 'selectionMode'
  | 'selectedItemIds'
  | 'onSelectionChange'
  | 'selectRowAriaLabel'
  | 'selectAllAriaLabel'
>;

/** Props for `AddOnCatalogModal`. */
export interface AddOnCatalogModalProps {
  /** Entity type of the rows, e.g. `CatalogEntityType.Toolset`. */
  type: CatalogEntityType;
  /** The items the user can pick from, already mapped to catalog items. */
  items: CatalogItem[];
  /** The edited list's ids; those among `items` open checked, the others stay on Add. */
  attachedIds: string[];
  /** User-visible strings. */
  labels: AddOnCatalogModalLabels;
  /** Where the items' data stands. */
  status: CatalogLoadStatus;
  /** Why the items failed to load, shown under the failure title. */
  error?: string | null;
  /** Called by the Retry button shown on a failure; without it there is no Retry. */
  onRetry?: () => void;
  /** Further `ListView` props, e.g. `columnVisibility` or `credentialsBadgeLoggedOutLabel`. */
  listProps?: AddOnCatalogListProps;
  /** Content at the footer's start for the current checked set, e.g. a note on what is checked. */
  renderFooterStart?: (checkedIds: ReadonlySet<string>) => ReactNode;
  /** Called on Add with the new full id list. */
  onConfirm: (ids: string[]) => void;
  /** Called when the user cancels or closes the dialog. */
  onClose: () => void;
  /** Typography class of the heading above the list, forwarded to `CatalogPickerModal`. Defaults to `'dial-body-semi-text'`. */
  headingClassName?: string;
}

/** Add-on picker dialog: a catalog checklist that opens on the attached items and commits the checked set on Add. */
export const AddOnCatalogModal: FC<AddOnCatalogModalProps> = ({
  type,
  items,
  attachedIds,
  labels,
  status,
  error,
  onRetry,
  listProps,
  renderFooterStart,
  onConfirm,
  onClose,
  headingClassName,
}) => {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(attachedIds),
  );
  const listedIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );

  const { selectRow } = labels;
  const selectRowAriaLabel = useCallback(
    (item: CatalogItem) =>
      selectRow ? selectRow(item.name) : `Select ${item.name}`,
    [selectRow],
  );
  const handleConfirm = useCallback(
    () => onConfirm(applyCatalogSelection(attachedIds, checkedIds, listedIds)),
    [onConfirm, attachedIds, checkedIds, listedIds],
  );

  return (
    <CatalogPickerModal
      items={items}
      labels={labels}
      status={status}
      error={error}
      onRetry={onRetry}
      footerStart={renderFooterStart?.(checkedIds)}
      onConfirm={handleConfirm}
      onClose={onClose}
      headingClassName={headingClassName}
      listProps={{
        ...listProps,
        type,
        selectionMode: CatalogSelectionMode.Multiple,
        selectedItemIds: checkedIds,
        onSelectionChange: setCheckedIds,
        selectRowAriaLabel,
        selectAllAriaLabel: labels.selectAll ?? 'Select all',
      }}
    />
  );
};
