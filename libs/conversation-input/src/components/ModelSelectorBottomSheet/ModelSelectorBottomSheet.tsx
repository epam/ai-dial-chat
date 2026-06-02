import { mergeClasses, type DeploymentItem } from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DialButton,
  DialCloseButton,
  DialSearch,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconApps, IconCheck, IconRobot } from '@tabler/icons-react';
import {
  type CSSProperties,
  type FC,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { DeploymentIcon } from '../Input/DeploymentIcon.js';
import styles from './ModelSelectorBottomSheet.module.scss';

/** Props for the mobile bottom-sheet model selector. */
export interface ModelSelectorBottomSheetProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /** Title displayed in the sheet header and used as the dialog accessible name. */
  title: string;
  /** Accessible label for the close (×) button. */
  closeLabel: string;
  /** Placeholder text for the search input. Defaults to `'Search'`. */
  searchPlaceholder?: string;
  /** Called when the sheet should close (backdrop tap, close button, or Escape). */
  onClose: () => void;
  /** Full list of deployments to display. When `undefined` or empty, a state label is shown. `iconUrl` must already be resolved by the host app. */
  deployments?: DeploymentItem[];
  /** ID of the currently selected deployment. Shown with a checkmark. */
  selectedDeploymentId?: string | null;
  /** Called when the user taps a deployment; the sheet closes automatically after. */
  onSelect: (id: string) => void;
  /** Label shown as a disabled item while deployments are loading. */
  loadingLabel?: string;
  /** Label shown as a disabled item when the deployments fetch failed. */
  errorLabel?: string;
  /** Label shown as a disabled item when the deployments list is empty. */
  emptyLabel?: string;
  /** Inline CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
  /** Typography class applied to the sheet title. Defaults to `'dial-body-semi-bold-text'`. */
  titleClassName?: string;
  /** Typography class applied to each item label and the state label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
}

/**
 * A bottom-sheet overlay for the model/deployment selector on mobile viewports.
 * Renders via a React portal so it sits above all other content.
 * Includes a search input that filters the list as the user types.
 */
export const ModelSelectorBottomSheet: FC<ModelSelectorBottomSheetProps> = ({
  isOpen,
  title,
  closeLabel,
  searchPlaceholder = 'Search',
  onClose,
  deployments,
  selectedDeploymentId,
  onSelect,
  loadingLabel,
  errorLabel,
  emptyLabel,
  style,
  titleClassName = 'dial-body-semi-bold-text',
  labelClassName = 'dial-small-text',
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset search query each time the sheet closes
  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const hasDeployments = deployments && deployments.length > 0;

  const stateLabel = !hasDeployments
    ? (loadingLabel ?? errorLabel ?? emptyLabel)
    : undefined;

  const q = query.trim().toLowerCase();
  const filtered = hasDeployments
    ? q
      ? deployments.filter((item) =>
          (item.displayName ?? item.id).toLowerCase().includes(q),
        )
      : deployments
    : [];

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="bg-black/50 fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        style={style}
        className={mergeClasses(
          styles.sheet,
          'fixed bottom-0 left-0 right-0 z-50 flex max-h-[80dvh] flex-col',
        )}
      >
        {/* Header */}
        <div className="relative flex h-[60px] flex-shrink-0 items-center justify-center px-4">
          <span className={mergeClasses(styles.title, titleClassName)}>
            {title}
          </span>
          <div className="absolute right-2">
            <DialCloseButton
              ariaLabel={closeLabel}
              size={BASE_ICON_SIZE}
              onClose={onClose}
            />
          </div>
        </div>

        <div className={mergeClasses(styles.divider, 'h-px flex-shrink-0')} />

        {/* Search */}
        {hasDeployments && (
          <>
            <div className="flex-shrink-0 px-4 py-[10px]">
              <DialSearch
                value={query}
                placeholder={searchPlaceholder}
                size={ElementSize.Standard}
                onChange={setQuery}
              />
            </div>
            <div
              className={mergeClasses(styles.divider, 'h-px flex-shrink-0')}
            />
          </>
        )}

        {/* List */}
        <ul role="list" className="flex flex-col overflow-y-auto">
          {stateLabel ? (
            <li
              className={mergeClasses(
                styles.stateLabel,
                labelClassName,
                'px-4 py-4',
              )}
            >
              {stateLabel}
            </li>
          ) : (
            filtered.map((item) => {
              let modelIcon: ReactNode;
              if (item.iconUrl) {
                const fallback =
                  item.type === 'application' ? (
                    <IconApps size={DIAL_ICON_SIZE.SM} aria-hidden />
                  ) : (
                    <IconRobot size={DIAL_ICON_SIZE.SM} aria-hidden />
                  );
                modelIcon = (
                  <DeploymentIcon
                    src={item.iconUrl}
                    size={DIAL_ICON_SIZE.SM}
                    fallback={fallback}
                  />
                );
              } else if (item.type === 'application') {
                modelIcon = <IconApps size={DIAL_ICON_SIZE.SM} aria-hidden />;
              } else {
                modelIcon = <IconRobot size={DIAL_ICON_SIZE.SM} aria-hidden />;
              }

              const isSelected = item.id === selectedDeploymentId;

              return (
                <li key={item.id}>
                  <DialButton
                    type="button"
                    className={mergeClasses(
                      styles.item,
                      'flex w-full items-center gap-3 px-4 py-[10px]',
                    )}
                    iconBefore={
                      <span className={styles.itemIcon}>{modelIcon}</span>
                    }
                    label={
                      <span className="flex flex-1 items-center justify-between gap-2">
                        <span
                          className={mergeClasses(
                            labelClassName,
                            'min-w-0 flex-1 truncate text-left',
                          )}
                        >
                          {item.displayName ?? item.id}
                        </span>
                        {isSelected && (
                          <IconCheck
                            size={DIAL_ICON_SIZE.SM}
                            className={styles.checkIcon}
                            aria-hidden
                          />
                        )}
                      </span>
                    }
                    onClick={() => handleSelect(item.id)}
                  />
                </li>
              );
            })
          )}
        </ul>
      </div>
    </>,
    document.body,
  );
};
