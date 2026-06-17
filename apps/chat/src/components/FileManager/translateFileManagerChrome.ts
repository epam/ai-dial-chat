import { Translation } from '@/src/types/translation';

import { ChatI18nKeys, SideBarI18nKeys } from '@/src/constants/i18n';

type TranslateFn = (
  key: string,
  options?: { lng?: string; ns?: Translation },
) => string;

export function translateFileManagerChrome(
  key: string,
  locale: string | undefined,
  t: TranslateFn,
  translateChat: TranslateFn,
): string {
  const lngOptions = locale ? { lng: locale } : undefined;
  const translateWithLocale = (fn: TranslateFn): string =>
    lngOptions ? fn(key, lngOptions) : fn(key);

  const translators =
    locale && locale !== 'en' ? [translateChat, t] : [t, translateChat];

  for (const translate of translators) {
    const result = translateWithLocale(translate);
    if (result !== key) {
      return result;
    }
  }

  const sidebar = translateWithLocale(t);
  const chat = translateWithLocale(translateChat);

  if (key === SideBarI18nKeys.FileManagerSearchPlaceholder) {
    const search = lngOptions
      ? translateChat(ChatI18nKeys.Search, lngOptions)
      : translateChat(ChatI18nKeys.Search);
    if (search !== ChatI18nKeys.Search) {
      return `${search}...`;
    }
  }

  return chat !== key ? chat : sidebar;
}

const DESTINATION_SEARCH_INPUT_ID = 'file-manager-destination-search';
const NEW_FOLDER_NAME_PATTERN = /^New folder( \d+)?$/;

export interface DestinationFolderPopupDomLabels {
  searchPlaceholder: string;
  cancelLabel: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  gridColumnHeaderLabels: Record<string, string>;
  translateNewFolderName: (value: string) => string;
}

export function findDestinationFolderPopupRoot(): Element | null {
  const searchInput = document.getElementById(DESTINATION_SEARCH_INPUT_ID);
  return (
    searchInput?.closest('[role="dialog"]') ??
    searchInput?.closest('.min-h-\\[500px\\]') ??
    document
      .getElementById('hidden-files-switch-modal')
      ?.closest('[role="dialog"]') ??
    null
  );
}

function patchFooterActions(popupRoot: Element, cancelLabel: string): void {
  const switchRoot = document.getElementById('hidden-files-switch-modal');
  const popupFooter = switchRoot?.closest('.flex.justify-between');
  const footerActions = popupFooter?.querySelector('.flex.space-x-4');
  const cancelButton =
    footerActions?.querySelector<HTMLButtonElement>('button');

  if (cancelButton?.textContent?.trim() === 'Cancel') {
    cancelButton.textContent = cancelLabel;
  }

  if (footerActions instanceof HTMLElement) {
    footerActions.style.gap = '1rem';
    footerActions.querySelectorAll(':scope > *').forEach((child) => {
      if (child instanceof HTMLElement) {
        child.style.marginLeft = '0';
        child.style.marginRight = '0';
      }
    });
  }

  popupRoot.querySelectorAll('.flex.space-x-4').forEach((row) => {
    if (!(row instanceof HTMLElement)) {
      return;
    }
    row.style.gap = '1rem';
    row.querySelectorAll(':scope > *').forEach((child) => {
      if (child instanceof HTMLElement) {
        child.style.marginLeft = '0';
        child.style.marginRight = '0';
      }
    });
  });
}

/** ui-kit embedded destination popup has no props for these strings. */
export function patchDestinationFolderPopupDom(
  labels: DestinationFolderPopupDomLabels,
  popupRoot = findDestinationFolderPopupRoot(),
): void {
  const searchInput = document.getElementById(DESTINATION_SEARCH_INPUT_ID);
  if (
    searchInput instanceof HTMLInputElement &&
    searchInput.placeholder !== labels.searchPlaceholder
  ) {
    searchInput.placeholder = labels.searchPlaceholder;
  }

  if (!popupRoot) {
    return;
  }

  patchFooterActions(popupRoot, labels.cancelLabel);

  popupRoot.querySelectorAll('button').forEach((button) => {
    if (button.textContent?.trim() === 'Cancel') {
      button.textContent = labels.cancelLabel;
    }
  });

  popupRoot.querySelectorAll('.ag-header-cell[col-id]').forEach((cell) => {
    const colId = cell.getAttribute('col-id');
    const label =
      colId &&
      labels.gridColumnHeaderLabels[
        colId as keyof typeof labels.gridColumnHeaderLabels
      ];
    if (!label) {
      return;
    }
    cell
      .querySelectorAll('.ag-header-cell-text, .ag-header-cell-label')
      .forEach((header) => {
        if (header.textContent?.trim() !== label) {
          header.textContent = label;
        }
      });
  });

  const englishTextReplacements: Record<string, string> = {
    Name: labels.gridColumnHeaderLabels.name,
    Path: labels.gridColumnHeaderLabels.path,
    'Modified Date':
      labels.gridColumnHeaderLabels.modifiedDate ??
      labels.gridColumnHeaderLabels.updatedAt,
    Size: labels.gridColumnHeaderLabels.size,
    Author: labels.gridColumnHeaderLabels.author,
    'No results found': labels.emptyStateTitle,
    'No options available': labels.emptyStateTitle,
    "Sorry, we couldn't find any results for your search.":
      labels.emptyStateDescription,
  };

  const textWalker = document.createTreeWalker(
    popupRoot,
    NodeFilter.SHOW_TEXT,
  );
  let textNode: Node | null = textWalker.nextNode();

  while (textNode) {
    const trimmed = textNode.textContent?.trim();
    const replacement = trimmed && englishTextReplacements[trimmed];

    if (replacement && trimmed !== replacement) {
      const parentElement =
        textNode.parentElement instanceof HTMLElement
          ? textNode.parentElement
          : null;

      if (
        trimmed === 'Name' ||
        trimmed === 'Path' ||
        trimmed === 'Modified Date' ||
        trimmed === 'Size' ||
        trimmed === 'Author'
      ) {
        if (parentElement?.closest('.ag-header-cell')) {
          textNode.textContent = replacement;
        }
      } else if (
        trimmed === 'No results found' ||
        trimmed === 'No options available' ||
        trimmed === "Sorry, we couldn't find any results for your search."
      ) {
        if (!parentElement?.closest('.ag-header-cell')) {
          textNode.textContent = replacement;
        }
      } else {
        textNode.textContent = replacement;
      }
    } else if (trimmed && NEW_FOLDER_NAME_PATTERN.test(trimmed)) {
      const translated = labels.translateNewFolderName(trimmed);
      if (translated !== trimmed) {
        textNode.textContent = translated;
      }
    }

    textNode = textWalker.nextNode();
  }

  popupRoot.querySelectorAll('[col-id="name"] input').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const translated = labels.translateNewFolderName(input.value.trim());
    if (translated !== input.value.trim()) {
      input.value = translated;
    }
  });
}

const CONFLICT_SINGLE_FILE_RADIO_NAME = 'single-file-conflict';
const CONFLICT_MULTIPLE_FILES_RADIO_NAME = 'multiple-files-conflict';
const CONFLICT_MULTIPLE_MESSAGE_PATTERN =
  /^(\d+) items with the same names already exist in this destination\.$/;

export interface ConflictResolutionPopupDomLabels {
  singleFileTitle: string;
  multipleFilesTitle: string;
  replaceLabel: string;
  itemExistsPrefix: string;
  itemExistsSuffix: string;
  multipleItemsExists: (count: string) => string;
}

export function findConflictResolutionPopupRoot(): Element | null {
  const conflictRadio =
    document.querySelector(`[name="${CONFLICT_SINGLE_FILE_RADIO_NAME}"]`) ??
    document.querySelector(`[name="${CONFLICT_MULTIPLE_FILES_RADIO_NAME}"]`);

  return conflictRadio?.closest('[role="dialog"]') ?? null;
}

/** ui-kit builds conflict description from hardcoded English fragments. */
export function patchConflictResolutionPopupDom(
  labels: ConflictResolutionPopupDomLabels,
): void {
  const popupRoot = findConflictResolutionPopupRoot();
  if (!popupRoot) {
    return;
  }

  popupRoot.querySelectorAll('h2, h3').forEach((heading) => {
    const text = heading.textContent?.trim();
    if (text === 'Replace Or Duplicate Item') {
      heading.textContent = labels.singleFileTitle;
    } else if (text === 'Replace Or Duplicate Items') {
      heading.textContent = labels.multipleFilesTitle;
    }
  });

  popupRoot.querySelectorAll('label[for*="replace"]').forEach((label) => {
    if (label.textContent?.trim() === 'Replace') {
      label.textContent = labels.replaceLabel;
    }
  });

  const textWalker = document.createTreeWalker(
    popupRoot,
    NodeFilter.SHOW_TEXT,
  );
  let textNode: Node | null = textWalker.nextNode();

  while (textNode) {
    const raw = textNode.textContent ?? '';
    const trimmed = raw.trim();

    if (trimmed === 'Replace Or Duplicate Item') {
      textNode.textContent = labels.singleFileTitle;
    } else if (trimmed === 'Replace Or Duplicate Items') {
      textNode.textContent = labels.multipleFilesTitle;
    } else if (
      trimmed === 'Item with the name ' ||
      raw === 'Item with the name '
    ) {
      textNode.textContent = labels.itemExistsPrefix;
    } else if (
      trimmed === 'already exists in this destination.' ||
      raw === 'already exists in this destination.'
    ) {
      textNode.textContent = labels.itemExistsSuffix;
    } else if (trimmed === 'Replace') {
      const parentElement =
        textNode.parentElement instanceof HTMLElement
          ? textNode.parentElement
          : null;
      if (parentElement?.closest('label')) {
        textNode.textContent = labels.replaceLabel;
      }
    } else {
      const multipleMatch = trimmed.match(CONFLICT_MULTIPLE_MESSAGE_PATTERN);
      if (multipleMatch) {
        textNode.textContent = labels.multipleItemsExists(multipleMatch[1]);
      }
    }

    textNode = textWalker.nextNode();
  }
}
