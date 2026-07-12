import { mergeClasses, useCodeCopy } from '@epam/ai-dial-chat-shared';
import {
  type FC,
  type KeyboardEvent,
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { SharePopoverProps } from '../../models/share-popover-props';
import { ShareLinkAccess, SharePopoverView } from '../../types/share';
import { AccessControl } from '../AccessControl/AccessControl';
import { LinkView } from '../LinkView/LinkView';
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
  errorClassName = 'dial-tiny-text',
  noteClassName = 'dial-tiny-text',
}) => {
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
    loadingLabel = 'Creating share link…',
    errorTitle = 'Couldn’t create the share link. Please try again.',
  } = labels ?? {};

  const [view, setView] = useState(SharePopoverView.Link);
  const { isCopied, copy } = useCodeCopy(url ?? '');

  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const accessTriggerRef = useRef<HTMLButtonElement>(null);
  const accessMenuRef = useRef<HTMLDivElement>(null);

  const handleAccessOpenChange = (next: boolean) => {
    setIsAccessOpen(next);
    if (!next) accessTriggerRef.current?.focus();
  };

  /* Focuses the currently-selected option once the menu opens. */
  useEffect(() => {
    if (!isAccessOpen) return;
    accessMenuRef.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus();
  }, [isAccessOpen]);

  const containerRef = useRef<HTMLDivElement>(null);
  /* Moves focus into the popover as soon as it opens. */
  useEffect(() => {
    containerRef.current?.focus();
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
   * Traps Tab within the popover: while the access menu is open, cycles
   * between its own two options (which live in a floating-ui portal, so
   * they're outside `containerRef`'s DOM subtree and need their own
   * boundary check); otherwise cycles within the popover's own controls.
   */
  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    const scope = isAccessOpen
      ? Array.from(
          accessMenuRef.current?.querySelectorAll<HTMLElement>(
            '[role="menuitemradio"]',
          ) ?? [],
        )
      : Array.from(
          containerRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        );
    if (scope.length === 0) return;
    const first = scope[0];
    const last = scope[scope.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
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

  const handleAccessMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(
      accessMenuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]',
      ) ?? [],
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className="flex w-[344px] flex-col outline-none"
      onKeyDownCapture={handleKeyDownCapture}
    >
      <SharePopoverHeader
        title={title}
        view={view}
        qrButtonLabel={qrButtonLabel}
        linkLabel={linkLabel}
        onViewChange={setView}
      />

      <div className={mergeClasses('mx-4 h-px', styles.divider)} />

      <div className="flex flex-col gap-3 px-4 py-3.5">
        {isLoading && <LoadingSkeleton ariaLabel={loadingLabel} />}

        {!isLoading && error != null && (
          <p
            role="alert"
            className={mergeClasses(
              errorClassName,
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
              onMenuKeyDown={handleAccessMenuKeyDown}
              triggerRef={accessTriggerRef}
              menuRef={accessMenuRef}
            />
            <p className={mergeClasses(noteClassName, styles.note)}>
              {canEditAccess && access === ShareLinkAccess.Edit
                ? visibilityNoteEdit
                : visibilityNote}
            </p>

            {view === SharePopoverView.Qr ? (
              <QrCode value={url} ariaLabel={qrCodeAriaLabel} />
            ) : (
              <LinkView
                url={url}
                linkLabel={linkLabel}
                linkAriaLabel={linkAriaLabel}
                isCopied={isCopied}
                copyButtonLabel={copyButtonLabel}
                copiedButtonLabel={copiedButtonLabel}
                onCopy={copy}
              />
            )}
            {expiryNote != null && (
              <p className={mergeClasses(noteClassName, styles.note)}>
                {expiryNote}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default memo(SharePopover);
