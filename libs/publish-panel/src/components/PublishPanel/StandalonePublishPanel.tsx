import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { CloseButton } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode, RefObject, useEffect, useMemo, useRef } from 'react';
import {
  PublicationRule,
  PublishFolderNode,
  PublishHistoryEntry,
  PublishResourceSummary,
} from '../../models/publish';
import { derivePublishState } from '../../utils/publish-state';
import { PublishFooter, PublishFooterLabels } from './PublishFooter';
import { PublishPanel, PublishPanelLabels } from './PublishPanel';
import styles from './StandalonePublishPanel.module.scss';

/** Text overrides for all user-visible strings in {@link StandalonePublishPanel} not already covered by `PublishPanelLabels`/`PublishFooterLabels`. */
export interface StandalonePublishPanelLabels {
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
  /**
   * Display metadata for the summary row and for version-derived behavior.
   * Title-only rendering applies when `renderSummary` is absent.
   */
  resource?: PublishResourceSummary;
  /**
   * Renders a custom summary row in place of the default title-only row.
   * Pass `resource` alongside this so version-derived behavior keeps working.
   * See `PublishPanel`'s `renderSummary` prop.
   */
  renderSummary?: () => ReactNode;
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
  /** Current access rules, combined with AND. */
  rules: PublicationRule[];
  /** Called with the full next rules array on add, remove, or clear. */
  onRulesChange: (rules: PublicationRule[]) => void;
  /** Options offered in the access-rules editor's source picker. */
  ruleSourceOptions: string[];
  /** Whether existing rules are currently being fetched for the selected folder. Default: `false`. */
  isRulesLoading?: boolean;
  /** Whether the most recent existing-rules fetch failed. Default: `false`. */
  hasRulesLoadError?: boolean;
  /** Called when the panel should be dismissed — Close button, Cancel button, backdrop click, or Escape. */
  onClose: () => void;
  /** Focus target restored when an open panel closes or unmounts. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Called when the user confirms the publish action. */
  onSubmit: () => void;
  /** Text overrides for the panel body. */
  panelLabels?: PublishPanelLabels;
  /** Text overrides for the pinned footer. */
  footerLabels?: PublishFooterLabels;
  /** Text overrides for the header/shell. */
  labels?: StandalonePublishPanelLabels;
  /** Typography class for the header title. Default: `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Color overrides. */
  colors?: StandalonePublishPanelColors;
}

/** Color overrides for {@link StandalonePublishPanel}, applied as CSS custom properties with app theme fallbacks. */
export interface StandalonePublishPanelColors {
  /** Backdrop background color. Fallback: `--bg-blackout`. */
  backdropBackground?: string;
  /** Panel background color. Fallback: `--bg-layer-raised`. */
  panelBackground?: string;
  /** Panel's leading-edge border color (desktop only). Fallback: `--stroke-secondary`. */
  panelBorder?: string;
  /** Divider border color below the header. Fallback: `--stroke-tertiary`. */
  dividerBorder?: string;
  /** Scrollbar thumb color of the scrollable content area. Fallback: `--stroke-secondary`. */
  scrollbarThumb?: string;
  /** Header title text color. Fallback: `--text-primary`. */
  titleText?: string;
}

/** Standalone end-edge slide-in panel for the Publish flow: full-screen backdrop, entity summary, folder picker, history list, and pinned footer. */
export const StandalonePublishPanel: FC<StandalonePublishPanelProps> = ({
  isOpen,
  resource,
  renderSummary,
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
  rules,
  onRulesChange,
  ruleSourceOptions,
  isRulesLoading = false,
  hasRulesLoadError = false,
  onClose,
  returnFocusRef,
  onSubmit,
  panelLabels,
  footerLabels,
  labels = {},
  titleClassName = 'dial-body-semi-text',
  colors,
}) => {
  const cssVars = buildCssVars({
    '--spp-backdrop-bg': colors?.backdropBackground,
    '--spp-panel-bg': colors?.panelBackground,
    '--spp-panel-border': colors?.panelBorder,
    '--spp-divider-border': colors?.dividerBorder,
    '--spp-scrollbar-thumb': colors?.scrollbarThumb,
    '--spp-title-text': colors?.titleText,
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const {
    title = 'Publish',
    ariaLabel = 'Publish',
    closeAriaLabel = 'Close',
  } = labels;

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

    const panel = panelRef.current;
    if (!panel) return;

    const focusPanel = () => panel.focus({ preventScroll: true });
    focusPanel();

    /*
     * The control that opens this panel is typically a floating-ui menu item,
     * and such a menu hands focus back to its own trigger from a microtask
     * queued while it unmounts — during the same commit that mounts this
     * panel, so it lands after the synchronous focus above. Guarding the first
     * frame pulls any such hand-back straight back into the panel. The guard
     * is torn down on the next frame so that popovers the panel itself renders
     * through a portal (folder row menus, the rule source picker) keep focus.
     */
    const handleFocusIn = (event: FocusEvent) => {
      if (!panel.contains(event.target as Node)) {
        focusPanel();
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    const guardFrameId = requestAnimationFrame(() => {
      document.removeEventListener('focusin', handleFocusIn);
    });

    const returnFocusTarget = returnFocusRef?.current;

    return () => {
      cancelAnimationFrame(guardFrameId);
      document.removeEventListener('focusin', handleFocusIn);
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
        style={cssVars}
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
        style={cssVars}
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
          <span
            className={mergeClasses(
              'flex-1 text-center',
              titleClassName,
              styles.title,
            )}
          >
            {title}
          </span>
          <div className="flex flex-1 justify-end">
            <CloseButton
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
              resource={resource}
              renderSummary={renderSummary}
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
              rules={rules}
              onRulesChange={onRulesChange}
              ruleSourceOptions={ruleSourceOptions}
              isRulesLoading={isRulesLoading}
              hasRulesLoadError={hasRulesLoadError}
              labels={panelLabels}
            />
          </div>
        </div>

        <PublishFooter
          version={resource?.version}
          hasExistingPublicationInFolder={hasExistingPublicationInFolder}
          isSubmitDisabled={derived.isSubmitDisabled}
          isSubmitLoading={derived.isSubmitLoading}
          onCancel={onClose}
          onSubmit={onSubmit}
          labels={footerLabels}
        />
      </div>
    </>
  );
};
