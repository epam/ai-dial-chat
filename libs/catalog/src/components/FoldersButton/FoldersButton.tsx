import {
  buildCssVars,
  mergeClasses,
  useIsPhone,
} from '@epam/ai-dial-chat-shared';
import {
  BottomSheet,
  Button,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  DropdownOverlayRole,
  ElementSize,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { FC, useRef, useState } from 'react';
import { DEFAULT_CATALOG_FOLDER_LABELS } from '../../constants/catalog-folders';
import type {
  CatalogFolderLabels,
  CatalogFolderNode,
} from '../../models/catalog-folders';
import type { CatalogFolderSelection } from '../../types/catalog-folders';
import {
  CatalogFolderTree,
  type FolderTreeColors,
} from '../CatalogFolderTree/CatalogFolderTree';
import styles from './FoldersButton.module.scss';

/** Color overrides for `FoldersButton`, applied as CSS custom properties. */
export interface FoldersButtonColors {
  /** Text and chevron color of the desktop button. Fallback: `--text-accent`. */
  label?: string;
  /** Overlay background of the desktop popover. Fallback: `--bg-layer-raised`. */
  overlayBackground?: string;
  /** Overlay border color of the desktop popover. Fallback: `--stroke-tertiary`. */
  overlayBorder?: string;
  /** Overlay shadow color of the desktop popover. Fallback: `--shadow-lg`. */
  overlayShadow?: string;
}

/** Props for FoldersButton. */
export interface FoldersButtonProps {
  /** Root nodes listed under "All entities". */
  tree: CatalogFolderNode[];
  /** Selected folder. */
  selection: CatalogFolderSelection;
  /** Called with the picked folder. */
  onChange: (selection: CatalogFolderSelection) => void;
  /** Text of the control and the tree. Default: `DEFAULT_CATALOG_FOLDER_LABELS`. */
  labels?: CatalogFolderLabels;
  /** Typography class of the button text. Default: `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** Typography class of the tree rows. Default: `'dial-small-text'`. */
  rowClassName?: string;
  /** Color overrides of the control. */
  colors?: FoldersButtonColors;
  /** Color overrides of the tree. */
  treeColors?: FolderTreeColors;
}

/*
 * Not lazy-loaded: the trigger is always on screen and the tree is a small
 * module with no heavy dependency, so a separate chunk would only add a
 * request (see .claude/rules/bundle-performance.md).
 */
/** Opens the catalog folder tree: a popover from 768px, a bottom sheet below it. */
export const FoldersButton: FC<FoldersButtonProps> = ({
  tree,
  selection,
  onChange,
  labels = DEFAULT_CATALOG_FOLDER_LABELS,
  labelClassName = 'dial-small-semi-text',
  rowClassName,
  colors,
  treeColors,
}) => {
  const isPhone = useIsPhone();
  const [isOpen, setIsOpen] = useState(false);
  const phoneTriggerRef = useRef<HTMLButtonElement>(null);
  const cssVars = buildCssVars({
    '--cat-folders-btn-label': colors?.label,
    '--cat-folders-overlay-bg': colors?.overlayBackground,
    '--cat-folders-overlay-border': colors?.overlayBorder,
    '--cat-folders-overlay-shadow': colors?.overlayShadow,
  });

  const handleSelect = (next: CatalogFolderSelection) => {
    onChange(next);
    setIsOpen(false);
  };

  const handleSheetClose = () => {
    setIsOpen(false);
    phoneTriggerRef.current?.focus();
  };

  const treeElement = (
    <CatalogFolderTree
      tree={tree}
      selection={selection}
      onSelect={handleSelect}
      allEntitiesLabel={labels.allEntities}
      ariaLabel={labels.tree}
      rowClassName={rowClassName}
      colors={treeColors}
    />
  );

  if (isPhone) {
    return (
      <>
        <GhostIconButton
          ref={phoneTriggerRef}
          size={ElementSize.Standard}
          className="shrink-0 rounded-full!"
          aria-label={labels.button}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
          icon={
            <IconChevronDown
              size={DIAL_ICON_SIZE.SM}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
          }
        />
        <BottomSheet
          open={isOpen}
          title={labels.button}
          onClose={handleSheetClose}
          bodyClassName="p-2"
        >
          {isOpen && treeElement}
        </BottomSheet>
      </>
    );
  }

  return (
    <Dropdown
      matchReferenceWidth={false}
      placement="bottom-start"
      open={isOpen}
      onOpenChange={setIsOpen}
      listClassName="!bg-transparent !shadow-none !p-0"
      overlayRole={DropdownOverlayRole.Dialog}
      overlayAriaLabel={labels.tree}
      optionArrowNavigation={false}
      // The tree focuses its selected row itself.
      initialFocus={-1}
      className="shrink-0"
      renderOverlay={() => (
        <div
          /* Capped at the design's 700px and at the live available height, so
           * the tree scrolls inside the popover. */
          style={{
            ...cssVars,
            maxHeight:
              'min(700px, calc(var(--fui-available-height, 9999px) - 8px))',
          }}
          className={mergeClasses(
            'flex min-w-[280px] flex-col overflow-y-auto rounded-xl p-[6px]',
            styles.overlay,
          )}
        >
          {treeElement}
        </div>
      )}
    >
      <Button
        label={labels.button}
        style={cssVars}
        textClassName={mergeClasses(styles.label, labelClassName)}
        className="h-8 shrink-0 gap-1 px-2"
        iconAfter={
          <IconChevronDown
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            className={mergeClasses(
              'shrink-0 transition-transform motion-reduce:transition-none',
              styles.label,
              isOpen && 'rotate-180',
            )}
            aria-hidden
          />
        }
      />
    </Dropdown>
  );
};
