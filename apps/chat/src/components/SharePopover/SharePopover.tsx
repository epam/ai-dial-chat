import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
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
import { useTranslation } from 'react-i18next';
import { ShareI18nKeys } from '../../constants/translation-keys';
import { useShareLink } from '../../hooks/useShareLink/useShareLink';
import { ShareLinkAccess, SharePopoverView } from '../../types/share';
import { QrPlaceholder } from './QrPlaceholder';
import styles from './SharePopover.module.scss';

const SECTION_LABEL_CLASS_NAME =
  'dial-tiny-semi-text uppercase tracking-wider text-secondary';
const LINK_BUTTON_ID = 'share-popover-back-button';
const QR_BUTTON_ID = 'share-popover-qr-button';
/*
 * Only Agent-tab entities (Agent + Application, both shown under the
 * "Agents" catalog tab — see libs/catalog/src/utils/catalog-tabs.ts) and
 * Skill support edit access. Model and Toolset can only ever be shared
 * view-only, so their access control is a static label, not a dropdown.
 */
const EDITABLE_ACCESS_TYPES = new Set<CatalogEntityType>([
  CatalogEntityType.Agent,
  CatalogEntityType.Application,
  CatalogEntityType.Skill,
]);
/*
 * DialSkeleton's own default color resolves to `--bg-layer-3`, which is the
 * same white as this popover's `--bg-layer-0` background in this app's theme
 * (invisible white-on-white) — same issue CardGrid's skeleton already works
 * around by passing an explicit, visibly-contrasting token.
 */
const SKELETON_COLOR = 'var(--bg-layer-2, #EEF1F7)';

/** Props for {@link SharePopover}. */
interface SharePopoverProps {
  /** The catalog item being shared. */
  item: CatalogItem;
  /** Called when the popover should close. */
  onClose: () => void;
}

/**
 * Quick share popover: general link access, copy-to-clipboard, and an
 * in-place QR view-swap — no route change, one surface.
 */
const SharePopover: FC<SharePopoverProps> = ({ item, onClose }) => {
  const { t } = useTranslation();
  const { data, isLoading, error, setAccess } = useShareLink(item.id);
  const [view, setView] = useState(SharePopoverView.Link);
  const { isCopied, copy } = useCodeCopy(data?.url ?? '');
  const canEditAccess = EDITABLE_ACCESS_TYPES.has(item.type);

  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const accessTriggerRef = useRef<HTMLButtonElement>(null);
  const accessMenuRef = useRef<HTMLDivElement>(null);

  const handleAccessOpenChange = (next: boolean) => {
    setIsAccessOpen(next);
    if (!next) accessTriggerRef.current?.focus();
  };

  // Focuses the currently-selected option once the menu opens.
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
  // Moves focus into the popover as soon as it opens.
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
   * Without this, Tab off the last control escapes to the page behind the
   * popover, which also auto-closes it via the anchoring dropdown's own
   * dismiss-on-blur behavior.
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
   * Owns Escape handling entirely (rather than relying on the anchoring
   * dropdown's own dismiss-on-Escape) so the first Escape in QR view returns
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
    { value: ShareLinkAccess.View, label: t(ShareI18nKeys.AccessViewLabel) },
    { value: ShareLinkAccess.Edit, label: t(ShareI18nKeys.AccessEditLabel) },
  ];

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={t(ShareI18nKeys.Title)}
      tabIndex={-1}
      className="flex w-[344px] flex-col outline-none"
      onKeyDownCapture={handleKeyDownCapture}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="dial-small-semi-text text-primary">
          {t(ShareI18nKeys.Title)}
        </span>
        {view === SharePopoverView.Link ? (
          <GhostButton
            id={QR_BUTTON_ID}
            label={t(ShareI18nKeys.QrButtonLabel)}
            iconBefore={<IconQrcode size={DIAL_ICON_SIZE.SM} aria-hidden />}
            className="ms-auto"
            onClick={() => setView(SharePopoverView.Qr)}
          />
        ) : (
          <GhostButton
            id={LINK_BUTTON_ID}
            label={t(ShareI18nKeys.LinkButtonLabel)}
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
            aria-label={t(ShareI18nKeys.LoadingLabel)}
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

        {!isLoading && error && (
          <p
            role="alert"
            className="dial-tiny-text py-6 text-center text-error"
          >
            {t(ShareI18nKeys.ErrorTitle)}
          </p>
        )}

        {!isLoading && !error && data && (
          <>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-primary-alpha text-accent-primary">
                <IconWorld size={DIAL_ICON_SIZE.MD} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="dial-small-semi-text truncate text-primary">
                  {t(ShareI18nKeys.AnyoneWithLinkTitle)}
                </p>
                <p className="dial-tiny-text text-secondary">
                  {t(ShareI18nKeys.AnyoneWithLinkSubtitle)}
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
                      aria-label={t(ShareI18nKeys.AccessAriaLabel)}
                      tabIndex={-1}
                      className="min-w-[160px]"
                      onKeyDown={handleAccessMenuKeyDown}
                    >
                      {accessOptions.map((option) => {
                        const isChecked = data.access === option.value;
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
                              setAccess(option.value);
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
                        accessOptions.find(
                          (option) => option.value === data.access,
                        )?.label
                      }
                    </span>
                    <IconChevronDown
                      size={14}
                      strokeWidth={2.2}
                      className={mergeClasses(
                        'shrink-0 transition-transform duration-150',
                        styles.accessTriggerChevron,
                        isAccessOpen && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                </DialDropdown>
              ) : (
                <span
                  aria-label={t(ShareI18nKeys.AccessAriaLabel)}
                  className={mergeClasses(
                    'flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5',
                    styles.accessStaticLabel,
                  )}
                >
                  <span className={styles.accessTriggerLabel}>
                    {t(ShareI18nKeys.AccessViewLabel)}
                  </span>
                </span>
              )}
            </div>
            <p className="dial-tiny-text text-secondary">
              {t(
                canEditAccess && data.access === ShareLinkAccess.Edit
                  ? ShareI18nKeys.VisibilityNoteEdit
                  : ShareI18nKeys.VisibilityNote,
              )}
            </p>

            {view === SharePopoverView.Qr ? (
              <QrPlaceholder
                value={data.url}
                ariaLabel={t(ShareI18nKeys.QrCodeAriaLabel)}
              />
            ) : (
              <>
                <p className={mergeClasses(SECTION_LABEL_CLASS_NAME, 'mt-3')}>
                  {t(ShareI18nKeys.LinkLabel)}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={data.url}
                    aria-label={t(ShareI18nKeys.LinkAriaLabel)}
                    containerClassName="min-w-0 flex-1"
                    wrapperClassName={styles.linkInputWrapper}
                  />
                  <NeutralButton
                    label={
                      isCopied
                        ? t(ShareI18nKeys.CopiedButtonLabel)
                        : t(ShareI18nKeys.CopyButtonLabel)
                    }
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
                {/* Screen-reader-only announcement: the button's own label
                    change is visual-only and isn't reliably announced. */}
                <span role="status" aria-live="polite" className="sr-only">
                  {isCopied ? t(ShareI18nKeys.CopiedButtonLabel) : ''}
                </span>
              </>
            )}
            <p className="dial-tiny-text text-secondary">
              {t(ShareI18nKeys.ExpiryNote, { days: data.expiresInDays })}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(SharePopover);
