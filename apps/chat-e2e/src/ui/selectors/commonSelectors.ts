import { Attributes, Tags } from '@/src/ui/domData';

export const SwitcherSelectors = {
  switcherContainer: '[role="switch"]',
  switcherTitle: '[aria-label="switch-title"]',
};

export const ButtonSelectors = {
  buttonContainer: (ariaLabel: string) =>
    `${Tags.button}[${Attributes.ariaLabel}="${ariaLabel}"]:visible`,
};

export const TabSelectors = {
  tabContainer: '[role="tab"]',
};

export const DropdownSelectors = {
  dropdownContainer: '[aria-label="dropdown"]',
  dropdownItem: '[role="menuitem"]',
  dropdownItemText: '[aria-labelledby="item-text"]',
};

export const FolderTreeSelectors = {
  foldersTreeContainer: '[aria-label="folders-tree"]',
  folder: '[aria-label="folder"]',
  folderName: '#name',
};

export const NoDataContentSelectors = {
  noDataContainer: '[aria-label="no-data-container"]',
  noResultsTitle: '[aria-label="no-results-title"]',
  noResultsReason: '[aria-label="no-results-description"]',
};

export const BreadcrumbSelectors = {
  breadcrumbContainer: '[aria-label="Breadcrumb"]',
  breadcrumbItem: '[aria-label="breadcrumb-item"]',
  breadcrumbItemSeparator: '[aria-label="separator"]',
  breadcrumbItemContent: '#breadcrumb-item-content',
};

export const GridSelectors = {
  gridContainer: '[role="table"]',
  gridHeaderContainer: '.ag-header-container',
  gridHeaderColumn: (columnId: string) =>
    `${GridSelectors.gridHeaderContainer} [role="columnheader"]${GridSelectors.gridColumn(columnId)}`,
  gridHeaderColumnName: '.ag-header-cell-text',
  gridRowsContainer: '.ag-center-cols-container',
  gridLoader: '.ag-overlay-loading-center',
  gridRow: () => `${GridSelectors.gridRowsContainer} [role="row"]`,
  gridColumn: (columnId: string) => `[col-id="${columnId}"]`,
  gridCell: (columnId: string) =>
    `[role="gridcell"]${GridSelectors.gridColumn(columnId)}`,
  gridCellValue: '#name',
  loadingIndicator: '.ag-overlay-loading-center',
  gridViewPort: '.ag-body-viewport',
  gridBody: '.ag-body',
};

export const CheckboxSelectors = {
  checkboxContainer: '[aria-description="checkbox-container"]',
  checkbox: '[role="checkbox"]',
};

export const PopupSelectors = {
  popupContainer: '[role="dialog"][aria-modal="true"]',
  popupHeader: '#dial-popup-heading',
  popupContent: '[aria-label="popup-description"]',
};

export const LoaderSelectors = {
  loaderContainer: '[role="status"]',
};

export const InputSelectors = {
  value: (value: string) => `[value="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`,
  inputErrorIcon: (value: string) =>
    `.dial-input-error:has(input[value="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]) svg[aria-label="alert"]`,
};
