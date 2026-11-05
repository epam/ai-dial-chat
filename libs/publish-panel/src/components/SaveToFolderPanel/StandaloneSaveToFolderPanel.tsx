import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  GhostButton,
  NeutralButton,
  PrimaryButton,
  SideDrawer,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { FC, useEffect, useRef, useState } from 'react';
import type { FolderDestination } from '../../models/folder-destination';
import type { StandaloneSaveToFolderPanelProps } from '../../models/save-to-folder-panel';
import { SaveToFolderView } from '../../types/save-to-folder';
import { SaveToFolderPanel } from './SaveToFolderPanel';
import styles from './StandaloneSaveToFolderPanel.module.scss';

/** End-edge slide-in panel for saving a resource to a chosen folder, with a summary view and a folder view. */
export const StandaloneSaveToFolderPanel: FC<
  StandaloneSaveToFolderPanelProps
> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitDisabled = false,
  returnFocusRef,
  labels = {},
  colors,
  titleClassName = 'dial-body-semi-text',
  destination,
  onDestinationChange,
  isSubmitting = false,
  onPendingDestinationChange,
  ...bodyProps
}) => {
  const {
    title = 'Save',
    changeFolderTitle = 'Change folder',
    closeAriaLabel = 'Close',
    backAriaLabel = 'Back',
    cancelLabel = 'Cancel',
    saveLabel = 'Save',
    savingLabel = 'Saving…',
    selectLabel = 'Select',
  } = labels;
  const cssVars = buildCssVars({
    '--sstf-backdrop-bg': colors?.backdropBackground,
    '--sstf-panel-bg': colors?.panelBackground,
    '--sstf-panel-border': colors?.panelBorder,
    '--sstf-divider-border': colors?.dividerBorder,
    '--sstf-scrollbar-thumb': colors?.scrollbarThumb,
    '--sstf-title-text': colors?.titleText,
  });

  const [view, setView] = useState(SaveToFolderView.Main);
  const [pendingDestination, setPendingDestination] = useState<
    FolderDestination | undefined
  >(destination);
  const titleRef = useRef<HTMLSpanElement>(null);
  const changeFolderButtonRef = useRef<HTMLButtonElement>(null);

  // Every opening starts on the main view.
  useEffect(() => {
    if (isOpen) setView(SaveToFolderView.Main);
  }, [isOpen]);

  /*
   * Switching views moves focus to the new view's heading, and leaving the
   * folder view hands it back to the Change button that opened it.
   */
  const previousViewRef = useRef(view);
  useEffect(() => {
    if (previousViewRef.current === view) return;
    previousViewRef.current = view;
    if (view === SaveToFolderView.ChangeFolder) {
      titleRef.current?.focus({ preventScroll: true });
    } else {
      changeFolderButtonRef.current?.focus({ preventScroll: true });
    }
  }, [view]);

  /* The kit returns focus to whatever had it before opening; a host target takes over when given. */
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (wasOpen && !isOpen && returnFocusRef?.current?.isConnected) {
      returnFocusRef.current.focus({ preventScroll: true });
    }
  }, [isOpen, returnFocusRef]);

  const isChangingFolder = view === SaveToFolderView.ChangeFolder;

  const handlePendingDestinationChange = (
    next: FolderDestination | undefined,
  ) => {
    setPendingDestination(next);
    onPendingDestinationChange?.(next);
  };
  const handleChangeFolderClick = () => {
    handlePendingDestinationChange(destination);
    setView(SaveToFolderView.ChangeFolder);
  };
  /* Leaving without Select discards the pending folder, so the host hears the committed one again. */
  const handleBackToMain = () => {
    onPendingDestinationChange?.(destination);
    setView(SaveToFolderView.Main);
  };
  const handleSelect = () => {
    if (pendingDestination) onDestinationChange(pendingDestination);
    setView(SaveToFolderView.Main);
  };

  /* The title goes in as a node so the dialog keeps the main title as its name in both views. */
  return (
    <SideDrawer
      open={isOpen}
      onClose={onClose}
      header={
        <span
          ref={titleRef}
          tabIndex={-1}
          className={mergeClasses(
            'block truncate outline-none',
            titleClassName,
            styles.title,
          )}
        >
          {isChangingFolder ? changeFolderTitle : title}
        </span>
      }
      ariaLabel={title}
      onBack={isChangingFolder ? handleBackToMain : undefined}
      backAriaLabel={backAriaLabel}
      backDisabled={isSubmitting}
      closeAriaLabel={closeAriaLabel}
      closeDisabled={isSubmitting}
      style={cssVars}
      overlayStyle={cssVars}
      className={mergeClasses(
        styles.panel,
        'tablet:w-[540px]! tablet:max-w-[calc(100%-32px)]!',
      )}
      overlayClassName={styles.backdrop}
      headerClassName={mergeClasses('px-[22px]', styles.divider)}
      bodyClassName="flex flex-col overflow-hidden"
    >
      <div
        className={mergeClasses(
          'min-h-0 flex-1 overflow-y-auto p-[22px]',
          styles.content,
        )}
      >
        <SaveToFolderPanel
          {...bodyProps}
          view={view}
          destination={destination}
          onDestinationChange={onDestinationChange}
          isSubmitting={isSubmitting}
          onChangeFolderClick={handleChangeFolderClick}
          changeFolderButtonRef={changeFolderButtonRef}
          pendingDestination={pendingDestination}
          onPendingDestinationChange={handlePendingDestinationChange}
        />
      </div>

      {/* Below the desktop breakpoint the two actions split the row in half. */}
      <div
        className={mergeClasses(
          'flex items-center justify-end gap-2 border-t px-4 py-4 desktop:px-3.5',
          styles.footer,
        )}
      >
        <GhostButton
          label={cancelLabel}
          className="mobile:flex-1"
          disabled={isSubmitting}
          onClick={isChangingFolder ? handleBackToMain : onClose}
        />
        {isChangingFolder ? (
          <NeutralButton
            label={selectLabel}
            className="mobile:flex-1"
            disabled={pendingDestination == null}
            onClick={handleSelect}
          />
        ) : (
          <PrimaryButton
            label={isSubmitting ? savingLabel : saveLabel}
            className="mobile:flex-1"
            disabled={isSubmitDisabled || isSubmitting}
            iconBefore={
              isSubmitting ? (
                <span aria-hidden>
                  <Spinner size={DIAL_ICON_SIZE.SM} />
                </span>
              ) : undefined
            }
            onClick={onSubmit}
          />
        )}
      </div>
    </SideDrawer>
  );
};
