import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialCloseButton } from '@epam/ai-dial-ui-kit';
import { FC, RefObject, useEffect, useMemo, useRef } from 'react';
import { CatalogItem } from '../../models/catalog-item';
import {
  PublishFolderNode,
  PublishHistoryEntry,
  PublishResourceSummary,
} from '../../models/publish';
import { derivePublishState } from '../../utils/publish-state';
import { PublishFooter, PublishFooterTexts } from './PublishFooter';
import { PublishPanel, PublishPanelTexts } from './PublishPanel';
import styles from './StandalonePublishPanel.module.scss';

/** Text overrides for all user-visible strings in {@link StandalonePublishPanel} not already covered by `PublishPanelTexts`/`PublishFooterTexts`. */
export interface StandalonePublishPanelTexts {
  /** Header title. Default: `'Publish'`. */
  title?: string;
  /** Accessible label for the panel's `role="dialog"`. Default: `'Publish'`. */
  ariaLabel?: string;
  /** Accessible label for the header's Close button. Default: `'Close'`. */
  closeAriaLabel?: string;
}

/** Props for {@link StandalonePublishPanel}. */
export interface StandalonePublishPanelProps {
  /** Whether the panel is open (controls the slide-in animation and backdrop). */
  isOpen: boolean;
  /** The catalog entity being published. Mutually exclusive with `resource`. */
  item?: CatalogItem;
  /** Title-only summary for an unversioned resource (e.g. a conversation). Mutually exclusive with `item`. */
  resource?: PublishResourceSummary;
  /** Previously published entries for this item. */
  history: PublishHistoryEntry[];
  /** Whether `history` is currently being fetched. Default: `false`. */
  isHistoryLoading?: boolean;
  /** Whether the most recent history fetch failed. Default: `false`. */
  hasHistoryError?: boolean;
  /** Destination folders available for selection. */
  folderItems: PublishFolderNode[];
  /** Currently selected destination folder path. `undefined` means nothing selected; `[]` means the bucket root. */
  selectedFolderPath?: string[];
  /** Called when the user selects a destination folder or the root; `undefined` when deselected. */
  onSelectedFolderPathChange: (path: string[] | undefined) => void;
  /** Called when the user confirms a new folder name. */
  onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
  /** Externally-controlled set of expanded folder path keys. */
  expandedPaths?: Set<string>;
  /** Called when the set of expanded folders changes. */
  onExpandedPathsChange?: (paths: Set<string>) => void;
  /** Folder path keys currently being fetched by the host. */
  loadingPaths?: Set<string>;
  /** Whether `selectedFolderPath` already has this publication. */
  hasExistingPublicationInFolder: boolean;
  /** Whether the current user can publish to `selectedFolderPath`. */
  hasWriteAccess: boolean;
  /** Whether a publish request is currently in flight. */
  isSubmitting: boolean;
  /** Whether the most recent submit attempt failed. */
  hasSubmitError?: boolean;
  /**
   * Whether resubmitting when `hasExistingPublicationInFolder` is true is
   * allowed (catalog default) or blocked (conversations). Default `true`.
   */
  allowReplace?: boolean;
  /** Called when the panel should be dismissed — Close button, Cancel button, backdrop click, or Escape. */
  onClose: () => void;
  /** Focus target restored when an open panel closes or unmounts. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Called when the user confirms the publish action. */
  onSubmit: () => void;
  /** Text overrides for the panel body. */
  panelTexts?: PublishPanelTexts;
  /** Text overrides for the pinned footer. */
  footerTexts?: PublishFooterTexts;
  /** Text overrides for the header/shell. */
  texts?: StandalonePublishPanelTexts;
}

/** Standalone end-edge slide-in panel for the Publish flow: full-screen backdrop, entity summary, folder picker, history list, and pinned footer. */
export const StandalonePublishPanel: FC<StandalonePublishPanelProps> = ({
  isOpen,
  item,
  resource,
  history,
  isHistoryLoading = false,
  hasHistoryError = false,
  folderItems,
  selectedFolderPath,
  onSelectedFolderPathChange,
  onCreateFolder,
  expandedPaths,
  onExpandedPathsChange,
  loadingPaths,
  hasExistingPublicationInFolder,
  hasWriteAccess,
  isSubmitting,
  hasSubmitError = false,
  allowReplace = true,
  onClose,
  returnFocusRef,
  onSubmit,
  panelTexts,
  footerTexts,
  texts = {},
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    title = 'Publish',
    ariaLabel = 'Publish',
    closeAriaLabel = 'Close',
  } = texts;

  const derived = useMemo(
    () =>
      derivePublishState({
        hasSelectedFolder: selectedFolderPath != null,
        hasExistingPublicationInFolder,
        hasWriteAccess,
        isSubmitting,
        hasSubmitError,
        allowReplace,
      }),
    [
      selectedFolderPath,
      hasExistingPublicationInFolder,
      hasWriteAccess,
      isSubmitting,
      hasSubmitError,
      allowReplace,
    ],
  );

  useEffect(() => {
    if (!isOpen) return;

    panelRef.current?.focus({ preventScroll: true });
    const returnFocusTarget = returnFocusRef?.current;

    return () => {
      if (returnFocusTarget?.isConnected) {
        returnFocusTarget.focus({ preventScroll: true });
      }
    };
  }, [isOpen, returnFocusRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={mergeClasses(
          'fixed inset-0 z-[51] transition-opacity duration-300',
          styles.backdrop,
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={!isOpen}
        inert={!isOpen}
        tabIndex={-1}
        className={mergeClasses(
          'fixed inset-y-0 end-0 z-[52] flex w-full flex-col overflow-hidden',
          'desktop:rounded-ts-xl desktop:rounded-bs-xl desktop:w-[540px] desktop:border-s',
          'transition-transform duration-300',
          styles.panel,
          isOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-[22px] py-3">
          <div className="flex-1" />
          <span className="dial-body-semi-text flex-1 text-center text-primary">
            {title}
          </span>
          <div className="flex flex-1 justify-end">
            <DialCloseButton
              onClose={onClose}
              ariaLabel={closeAriaLabel}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className={mergeClasses('shrink-0', styles.divider)} />

        <div
          className={mergeClasses(
            'min-h-0 flex-1 overflow-y-auto',
            styles.content,
          )}
        >
          <div className="p-[22px]">
            <PublishPanel
              item={item}
              resource={resource}
              history={history}
              isHistoryLoading={isHistoryLoading}
              hasHistoryError={hasHistoryError}
              folderItems={folderItems}
              selectedFolderPath={selectedFolderPath}
              onSelectedFolderPathChange={onSelectedFolderPathChange}
              onCreateFolder={onCreateFolder}
              expandedPaths={expandedPaths}
              onExpandedPathsChange={onExpandedPathsChange}
              loadingPaths={loadingPaths}
              hasExistingPublicationInFolder={hasExistingPublicationInFolder}
              hasWriteAccess={hasWriteAccess}
              isSubmitting={isSubmitting}
              hasSubmitError={hasSubmitError}
              allowReplace={allowReplace}
              texts={panelTexts}
            />
          </div>
        </div>

        <PublishFooter
          version={item?.version ?? resource?.version}
          hasExistingPublicationInFolder={hasExistingPublicationInFolder}
          isSubmitDisabled={derived.isSubmitDisabled}
          isSubmitLoading={derived.isSubmitLoading}
          onCancel={onClose}
          onSubmit={onSubmit}
          texts={footerTexts}
        />
      </div>
    </>
  );
};
