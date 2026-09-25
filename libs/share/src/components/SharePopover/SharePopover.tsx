import {
  buildCssVars,
  mergeClasses,
  useCodeCopy,
} from '@epam/ai-dial-chat-shared';
import {
  type FC,
  type KeyboardEvent,
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';
import { SHARE_CLASS } from '../../constants/public-class-names';
import type { SharePopoverProps } from '../../models/share-popover-props';
import { ShareLinkAccess, SharePopoverView } from '../../types/share';
import {
  focusFirstInteractiveElement,
  getInteractiveElements,
} from '../../utils/focus';
import { AccessControl } from '../AccessControl/AccessControl';
import { LinkView } from '../LinkView/LinkView';
import { QrActions } from '../QrActions/QrActions';
import { QrCode } from '../QrCode/QrCode';
import { LoadingSkeleton } from './LoadingSkeleton';
import styles from './SharePopover.module.scss';
import {
  LINK_BUTTON_ID,
  QR_BUTTON_ID,
  SharePopoverHeader,
} from './SharePopoverHeader';

/**
 * Quick share popover: general link access, copy-to-clipboard, and an
 * in-place QR view-swap — no route change, one surface.
 *
 * All runtime data is received via props; this component makes no API calls.
 */
const SharePopover: FC<SharePopoverProps> = ({
  url,
  isLoading,
  error,
  access,
  canEditAccess,
  onAccessChange,
  onClose,
  labels,
  className,
  styles: stylesProp,
}) => {
  const colors = stylesProp?.colors;
  const typography = stylesProp?.typography;

  const cssVars = buildCssVars({
    '--shp-access-trigger-bg': colors?.accessTriggerBackground,
    '--shp-access-trigger-border': colors?.accessTriggerBorder,
    '--shp-access-trigger-border-hover': colors?.accessTriggerBorderHover,
    '--shp-access-trigger-border-focus': colors?.accessTriggerBorderFocus,
    '--shp-access-trigger-text': colors?.accessTriggerText,
    '--shp-title-text': colors?.titleText,
    '--shp-link-icon-bg': colors?.linkIconBackground,
    '--shp-link-icon-text': colors?.linkIconText,
    '--shp-anyone-title': colors?.anyoneTitle,
    '--shp-anyone-subtitle': colors?.anyoneSubtitle,
    '--shp-access-chevron': colors?.accessChevron,
    '--shp-menu-item-label': colors?.menuItemLabel,
    '--shp-link-row-bg': colors?.linkRowBackground,
    '--shp-link-text': colors?.linkText,
    '--shp-error-text': colors?.errorText,
    '--shp-note-text': colors?.noteText,
    '--shp-divider': colors?.divider,
    '--shp-skeleton-color': colors?.skeletonColor,
  });
  const {
    title = 'Share',
    qrButtonLabel = 'QR',
    linkLabel = 'Link',
    anyoneWithLinkTitle = 'Anyone with the link',
    anyoneWithLinkSubtitle = 'in your organization',
    accessAriaLabel = 'Link access level',
    accessViewLabel = 'Can view',
    accessEditLabel = 'Can edit',
    visibilityNote = 'This deployment and its updates will be visible to users with the link.',
    visibilityNoteEdit = 'Anyone with the link will be able to view and edit this deployment.',
    copyButtonLabel = 'Copy',
    copiedButtonLabel = 'Copied',
    linkAriaLabel = 'Share link',
    expiryNote,
    qrCodeAriaLabel = 'QR code for the share link',
    qrCopyButtonLabel = 'Copy',
    qrCopiedButtonLabel = 'Copied',
    qrDownloadButtonLabel = 'Download',
    qrDownloadFileName = 'share-qr-code.png',
    loadingLabel = 'Creating share link…',
    errorTitle = 'Couldn’t create the share link. Please try again.',
    nestedItemsNote,
  } = labels ?? {};

  const [view, setView] = useState(SharePopoverView.Link);
  const { isCopied, copy } = useCodeCopy(url ?? '');
  const qrSvgRef = useRef<SVGSVGElement>(null);

  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const accessTriggerRef = useRef<HTMLButtonElement>(null);

  /*
   * Focus goes back to the trigger button itself: the kit's own return-focus
   * targets its wrapper element, which is not focusable.
   */
  const handleAccessOpenChange = (next: boolean) => {
    setIsAccessOpen(next);
    if (!next) accessTriggerRef.current?.focus();
  };

  const containerRef = useRef<HTMLDivElement>(null);

  /*
   * Moves focus to the popover's first control as soon as it opens, so the
   * keyboard user lands on a visibly focused element rather than on the
   * outline-less popover root. The deferred pass re-runs only if the host's
   * own focus management pulled focus back out in the same tick.
   */
  useEffect(() => {
    focusFirstInteractiveElement(containerRef.current);
    const timeoutId = setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        focusFirstInteractiveElement(containerRef.current);
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const idToFocus =
      view === SharePopoverView.Qr ? LINK_BUTTON_ID : QR_BUTTON_ID;
    document.getElementById(idToFocus)?.focus();
  }, [view]);

  /*
   * Traps Tab within the popover: inside the open access menu, cycles between
   * its own options (which live in a floating-ui portal, so they're outside
   * `containerRef`'s DOM subtree — the key event still reaches this handler
   * through the React tree); otherwise cycles within the popover's own
   * controls.
   */
  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    const menu = (e.target as HTMLElement).closest('[role="menu"]');
    const scope = menu
      ? Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
      : getInteractiveElements(containerRef.current);
    if (scope.length === 0) return;

    e.preventDefault();
    const currentIndex = scope.indexOf(document.activeElement as HTMLElement);
    const delta = e.shiftKey ? -1 : 1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + delta + scope.length) % scope.length;
    scope[nextIndex]?.focus();
  };

  /*
   * Owns Escape handling entirely so the first Escape in QR view returns
   * to the link view instead of closing the popover outright.
   */
  const handleKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      trapTab(e);
      return;
    }
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (isAccessOpen) {
      e.preventDefault();
      handleAccessOpenChange(false);
      return;
    }
    if (view === SharePopoverView.Qr) {
      e.preventDefault();
      setView(SharePopoverView.Link);
    } else {
      onClose();
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      style={cssVars}
      className={mergeClasses(
        'flex w-96 flex-col gap-3 rounded-xl bg-layer-raised px-6 pb-6 pt-4 shadow-lg outline-none',
        className,
        SHARE_CLASS.popover,
      )}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <SharePopoverHeader
        title={title}
        view={view}
        qrButtonLabel={qrButtonLabel}
        linkLabel={linkLabel}
        onViewChange={setView}
      />

      <div className={mergeClasses('-mt-1.5 h-px w-full', styles.divider)} />

      {isLoading && (
        <LoadingSkeleton
          ariaLabel={loadingLabel}
          skeletonColor={colors?.skeletonColor}
        />
      )}

      {!isLoading && error != null && (
        <p
          role="alert"
          className={mergeClasses(
            typography?.errorClassName ?? 'dial-tiny-text',
            'py-6 text-center',
            styles.errorText,
          )}
        >
          {errorTitle}
        </p>
      )}

      {!isLoading && error == null && url != null && (
        <>
          <AccessControl
            anyoneWithLinkTitle={anyoneWithLinkTitle}
            anyoneWithLinkSubtitle={anyoneWithLinkSubtitle}
            access={access}
            canEditAccess={canEditAccess}
            accessViewLabel={accessViewLabel}
            accessEditLabel={accessEditLabel}
            accessAriaLabel={accessAriaLabel}
            isOpen={isAccessOpen}
            onOpenChange={handleAccessOpenChange}
            onAccessChange={onAccessChange}
            triggerRef={accessTriggerRef}
            titleClassName={typography?.anyoneTitleClassName}
            subtitleClassName={typography?.anyoneSubtitleClassName}
            accessTriggerLabelClassName={
              typography?.accessTriggerLabelClassName
            }
          />
          <p
            className={mergeClasses(
              typography?.noteClassName ?? 'dial-tiny-text',
              styles.note,
            )}
          >
            {canEditAccess && access.includes(ShareLinkAccess.Edit)
              ? visibilityNoteEdit
              : visibilityNote}
          </p>

          {nestedItemsNote != null && (
            <p
              className={mergeClasses(
                typography?.nestedItemsNoteClassName ?? 'dial-tiny-semi-text',
                styles.note,
              )}
            >
              {nestedItemsNote}
            </p>
          )}

          {view === SharePopoverView.Qr ? (
            <>
              <QrCode
                value={url}
                labels={{ ariaLabel: qrCodeAriaLabel }}
                svgRef={qrSvgRef}
              />
              <QrActions
                url={url}
                getSvg={() => qrSvgRef.current}
                copyLabel={qrCopyButtonLabel}
                copiedLabel={qrCopiedButtonLabel}
                downloadLabel={qrDownloadButtonLabel}
                downloadFileName={qrDownloadFileName}
              />
            </>
          ) : (
            <LinkView
              url={url}
              linkAriaLabel={linkAriaLabel}
              isCopied={isCopied}
              copyButtonLabel={copyButtonLabel}
              copiedButtonLabel={copiedButtonLabel}
              onCopy={copy}
            />
          )}
          {expiryNote != null && (
            <p
              className={mergeClasses(
                typography?.noteClassName ?? 'dial-tiny-text',
                styles.note,
              )}
            >
              {expiryNote}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default memo(SharePopover);
