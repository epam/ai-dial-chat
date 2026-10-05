import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { SideDrawer } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode, RefObject, useEffect, useMemo, useState } from 'react';
import {
  PublicationRule,
  PublishFolderNode,
  PublishResourceSummary,
} from '../../models/publish';
import type { PublishPanelStyles } from '../../models/publish-panel-styles';
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
  /**
   * Display author recorded on the publication. Forwarded to
   * {@link PublishPanel} unmodified; an empty value never blocks submission.
   */
  author: string;
  /** Called with the next author value on every edit. */
  onAuthorChange: (author: string) => void;
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
  /** Style overrides for the panel body. */
  panelStyles?: PublishPanelStyles;
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

/** Standalone end-edge slide-in panel for the Publish flow: full-screen backdrop, entity summary, folder picker, and pinned footer. */
export const StandalonePublishPanel: FC<StandalonePublishPanelProps> = ({
  isOpen,
  resource,
  renderSummary,
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
  author,
  onAuthorChange,
  rules,
  onRulesChange,
  ruleSourceOptions,
  isRulesLoading = false,
  hasRulesLoadError = false,
  onClose,
  returnFocusRef,
  onSubmit,
  panelLabels,
  panelStyles,
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

  /*
   * A callback ref, not useRef: the kit portals the panel, so its content
   * mounts a render after this component and the effect below must re-run.
   */
  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(
    null,
  );
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

  /*
   * The kit drawer traps focus and handles Escape. It would return focus to
   * whatever was focused before it opened — often a menu item that is gone by
   * then — so the host's target takes over on close or unmount. Moving focus
   * synchronously here keeps the drawer from overriding it, since it leaves
   * focus alone once it has left the panel.
   */
  useEffect(() => {
    /* The kit renders the panel; it is reached from the body content inside it. */
    const panel = contentElement?.closest<HTMLElement>('[role="dialog"]');
    if (!isOpen || !panel) return;

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
  }, [isOpen, contentElement, returnFocusRef]);

  /*
   * The title goes in as a node so the dialog keeps its own name from
   * `labels.ariaLabel`; a string header would name it after the title.
   */
  return (
    <SideDrawer
      open={isOpen}
      onClose={onClose}
      header={
        <span
          className={mergeClasses(
            'block truncate text-center',
            titleClassName,
            styles.title,
          )}
        >
          {title}
        </span>
      }
      ariaLabel={ariaLabel}
      closeAriaLabel={closeAriaLabel}
      closeDisabled={isSubmitting}
      style={cssVars}
      overlayStyle={cssVars}
      className={styles.panel}
      overlayClassName={styles.backdrop}
      headerClassName={mergeClasses('px-[22px]', styles.divider)}
      bodyClassName="flex flex-col overflow-hidden"
    >
      <div
        ref={setContentElement}
        className={mergeClasses(
          'min-h-0 flex-1 overflow-y-auto',
          styles.content,
        )}
      >
        <div className="p-[22px]">
          <PublishPanel
            resource={resource}
            renderSummary={renderSummary}
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
            author={author}
            onAuthorChange={onAuthorChange}
            rules={rules}
            onRulesChange={onRulesChange}
            ruleSourceOptions={ruleSourceOptions}
            isRulesLoading={isRulesLoading}
            hasRulesLoadError={hasRulesLoadError}
            labels={panelLabels}
            styles={panelStyles}
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
    </SideDrawer>
  );
};
