import { mergeClasses, useCodeCopy } from '@epam/ai-dial-chat-shared';
import {
  GhostButton,
  GradientCheckIcon,
  Input,
  NeutralButton,
} from '@epam/ai-dial-kit';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialSkeleton,
  DialSkeletonVariant,
} from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconLink,
  IconQrcode,
  IconWorld,
} from '@tabler/icons-react';
import {
  type FC,
  type KeyboardEvent,
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ShareLinkAccess, SharePopoverView } from '../../types/share';
import { QrCode } from './QrCode';
import styles from './SharePopover.module.scss';

const LINK_BUTTON_ID = 'share-popover-back-button';
const QR_BUTTON_ID = 'share-popover-qr-button';

/*
 * DialSkeleton's own default color resolves to `--bg-layer-3`, which is the
 * same white as this popover's `--bg-layer-0` background in this app's theme
 * (invisible white-on-white). Pass an explicit contrasting token.
 */
const SKELETON_COLOR = 'var(--bg-layer-2, #EEF1F7)';
const SECTION_LABEL_CLASS_NAME =
  'dial-tiny-semi-text uppercase tracking-wider text-secondary';

/** All user-visible strings in {@link SharePopover}, with English defaults. */
export interface SharePopoverStrings {
  /** Popover heading and dialog `aria-label`. Defaults to `"Share"`. */
  title?: string;
  /** QR-tab button label. Defaults to `"QR"`. */
  qrButtonLabel?: string;
  /** Link-tab (back) button label. Defaults to `"Link"`. */
  linkButtonLabel?: string;
  /** Label above the URL input field. Defaults to `"Link"`. */
  linkLabel?: string;
  /** Primary row text. Defaults to `"Anyone with the link"`. */
  anyoneWithLinkTitle?: string;
  /** Secondary row text. Defaults to `"in your organization"`. */
  anyoneWithLinkSubtitle?: string;
  /** `aria-label` for the access-level control. Defaults to `"Link access level"`. */
  accessAriaLabel?: string;
  /** Access-dropdown option for view access. Defaults to `"Can view"`. */
  accessViewLabel?: string;
  /** Access-dropdown option for edit access. Defaults to `"Can edit"`. */
  accessEditLabel?: string;
  /** Visibility note shown when access is View. */
  visibilityNote?: string;
  /** Visibility note shown when access is Edit. */
  visibilityNoteEdit?: string;
  /** Copy button default label. Defaults to `"Copy"`. */
  copyButtonLabel?: string;
  /** Copy button label after copying. Defaults to `"Copied"`. */
  copiedButtonLabel?: string;
  /** `aria-label` for the share-link URL input. Defaults to `"Share link"`. */
  linkAriaLabel?: string;
  /** Pre-formatted expiry note (e.g. "This link is active for 3 days."). */
  expiryNote?: string;
  /** `aria-label` on the QR placeholder image. Defaults to `"QR code for the share link"`. */
  qrCodeAriaLabel?: string;
  /** `aria-label` for the loading skeleton. Defaults to `"Creating share link…"`. */
  loadingLabel?: string;
  /** Error message shown when share-link creation fails. */
  errorTitle?: string;
}

/** Props for {@link SharePopover}. */
export interface SharePopoverProps {
  /** Resolved share URL; `undefined` while loading. */
  url: string | undefined;
  /** Whether the share link is still being fetched. */
  isLoading: boolean;
  /** Set when the share link could not be created. */
  error: Error | null;
  /** Number of days the link stays active; `undefined` while loading. */
  expiresInDays: number | undefined;
  /** Current access level. */
  access: ShareLinkAccess;
  /** True for editable entity types (Agent, Application, Skill, Toolset); false for Model. */
  canEditAccess: boolean;
  /** Called when the user selects a different access level. */
  onAccessChange: (access: ShareLinkAccess) => void;
  /** Called when the popover should close. */
  onClose: () => void;
  /** Overrides for user-visible strings. All fields have English defaults. */
  strings?: SharePopoverStrings;
}

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
  expiresInDays,
  access,
  canEditAccess,
  onAccessChange,
  onClose,
  strings,
}) => {
  const {
    title = 'Share',
    qrButtonLabel = 'QR',
    linkButtonLabel = 'Link',
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
  } = strings ?? {};

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
    const frame = requestAnimationFrame(() => {
      accessMenuRef.current
        ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
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

  const accessOptions: { value: ShareLinkAccess; label: string }[] = [
    { value: ShareLinkAccess.View, label: accessViewLabel },
    { value: ShareLinkAccess.Edit, label: accessEditLabel },
  ];

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className="flex w-[344px] flex-col outline-none"
      onKeyDownCapture={handleKeyDownCapture}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="dial-small-semi-text text-primary">{title}</span>
        {view === SharePopoverView.Link ? (
          <GhostButton
            id={QR_BUTTON_ID}
            label={qrButtonLabel}
            iconBefore={<IconQrcode size={DIAL_ICON_SIZE.SM} aria-hidden />}
            className="ms-auto"
            onClick={() => setView(SharePopoverView.Qr)}
          />
        ) : (
          <GhostButton
            id={LINK_BUTTON_ID}
            label={linkButtonLabel}
            iconBefore={<IconLink size={DIAL_ICON_SIZE.SM} aria-hidden />}
            className="ms-auto"
            onClick={() => setView(SharePopoverView.Link)}
          />
        )}
      </div>

      <div className={mergeClasses('mx-4', styles.divider)} />

      <div className="flex flex-col gap-3 px-4 py-3.5">
        {isLoading && (
          <div
            role="status"
            aria-label={loadingLabel}
            className="flex flex-col gap-3"
          >
            <div aria-hidden className="flex items-center gap-2.5">
              <DialSkeleton
                variant={DialSkeletonVariant.Circular}
                width={32}
                height={32}
                color={SKELETON_COLOR}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <DialSkeleton
                  variant={DialSkeletonVariant.Text}
                  width="70%"
                  height={16}
                  color={SKELETON_COLOR}
                />
                <DialSkeleton
                  variant={DialSkeletonVariant.Text}
                  width="45%"
                  height={12}
                  color={SKELETON_COLOR}
                />
              </div>
              <DialSkeleton
                variant={DialSkeletonVariant.Rectangular}
                width={92}
                height={30}
                color={SKELETON_COLOR}
              />
            </div>
            <div aria-hidden className="flex flex-col gap-1.5">
              <DialSkeleton
                variant={DialSkeletonVariant.Text}
                width="100%"
                height={12}
                color={SKELETON_COLOR}
              />
              <DialSkeleton
                variant={DialSkeletonVariant.Text}
                width="60%"
                height={12}
                color={SKELETON_COLOR}
              />
            </div>
            <DialSkeleton
              aria-hidden
              variant={DialSkeletonVariant.Rectangular}
              width="100%"
              height={40}
              color={SKELETON_COLOR}
            />
            <DialSkeleton
              aria-hidden
              variant={DialSkeletonVariant.Text}
              width="50%"
              height={12}
              color={SKELETON_COLOR}
            />
          </div>
        )}

        {!isLoading && error != null && (
          <p
            role="alert"
            className="dial-tiny-text py-6 text-center text-error"
          >
            {errorTitle}
          </p>
        )}

        {!isLoading && error == null && url != null && (
          <>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-primary-alpha text-accent-primary">
                <IconWorld size={DIAL_ICON_SIZE.MD} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="dial-small-semi-text truncate text-primary">
                  {anyoneWithLinkTitle}
                </p>
                <p className="dial-tiny-text text-secondary">
                  {anyoneWithLinkSubtitle}
                </p>
              </div>
              {canEditAccess ? (
                <DialDropdown
                  matchReferenceWidth={false}
                  placement="bottom-end"
                  open={isAccessOpen}
                  onOpenChange={handleAccessOpenChange}
                  listClassName="cp-dropdown-overlay"
                  renderOverlay={() => (
                    <div
                      ref={accessMenuRef}
                      role="menu"
                      aria-label={accessAriaLabel}
                      tabIndex={-1}
                      className="min-w-[160px]"
                      onKeyDown={handleAccessMenuKeyDown}
                    >
                      {accessOptions.map((option) => {
                        const isChecked = access === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={isChecked}
                            className={mergeClasses(
                              'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-start outline-none',
                              styles.accessMenuItem,
                              isChecked && styles.accessMenuItemChecked,
                            )}
                            onClick={() => {
                              onAccessChange(option.value);
                              handleAccessOpenChange(false);
                            }}
                          >
                            <span className={styles.accessMenuItemLabel}>
                              {option.label}
                            </span>
                            {isChecked && (
                              <span className="ms-auto flex shrink-0 items-center">
                                <GradientCheckIcon
                                  gradientId={`share-access-check-${option.value}`}
                                />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                >
                  <button
                    ref={accessTriggerRef}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isAccessOpen}
                    className={mergeClasses(
                      'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 outline-none',
                      styles.accessTriggerBtn,
                      isAccessOpen && styles.accessTriggerBtnOpen,
                    )}
                  >
                    <span className={styles.accessTriggerLabel}>
                      {
                        accessOptions.find((option) => option.value === access)
                          ?.label
                      }
                    </span>
                    <IconChevronDown
                      size={14}
                      strokeWidth={2.2}
                      className={mergeClasses(
                        'shrink-0 transition-transform duration-150 rtl:scale-x-[-1]',
                        styles.accessTriggerChevron,
                        isAccessOpen && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                </DialDropdown>
              ) : (
                <span
                  aria-label={accessAriaLabel}
                  className={mergeClasses(
                    'flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5',
                    styles.accessStaticLabel,
                  )}
                >
                  <span className={styles.accessTriggerLabel}>
                    {accessViewLabel}
                  </span>
                </span>
              )}
            </div>
            <p className="dial-tiny-text text-secondary">
              {canEditAccess && access === ShareLinkAccess.Edit
                ? visibilityNoteEdit
                : visibilityNote}
            </p>

            {view === SharePopoverView.Qr ? (
              <QrCode value={url} ariaLabel={qrCodeAriaLabel} />
            ) : (
              <>
                <p className={mergeClasses(SECTION_LABEL_CLASS_NAME, 'mt-3')}>
                  {linkLabel}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={url}
                    aria-label={linkAriaLabel}
                    containerClassName="min-w-0 flex-1"
                    wrapperClassName={styles.linkInputWrapper}
                  />
                  <NeutralButton
                    label={isCopied ? copiedButtonLabel : copyButtonLabel}
                    iconBefore={
                      isCopied ? (
                        <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
                      ) : (
                        <IconCopy size={DIAL_ICON_SIZE.SM} aria-hidden />
                      )
                    }
                    onClick={copy}
                    className="shrink-0"
                  />
                </div>
                {/* Screen-reader-only announcement: button label change is visual-only. */}
                <span role="status" aria-live="polite" className="sr-only">
                  {isCopied ? copiedButtonLabel : ''}
                </span>
              </>
            )}
            {expiryNote != null && (
              <p className="dial-tiny-text text-secondary">{expiryNote}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default memo(SharePopover);
