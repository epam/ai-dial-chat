import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, Dropdown, Spinner } from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import {
  memo,
  useCallback,
  useState,
  type FC,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DeploymentSelectorI18nKeys } from '../../constants/translation-keys';
import { useDeploymentSelectorFieldOverlay } from './useDeploymentSelectorFieldOverlay';

interface Props {
  /** Currently selected deployment id, or `null` when none is selected. */
  selectedId: string | null;
  /** Called with the newly selected deployment's id; the panel closes itself afterward. */
  onSelect: (id: string) => void;
  /** Text shown in the trigger when `selectedId` is `null`. */
  placeholder: string;
  /** Id of the host-rendered label element this trigger is described by. */
  labelledById?: string;
  /** When `true`, the trigger does not open and renders dimmed. Defaults to `false`. */
  isDisabled?: boolean;
  /** When `true`, the trigger renders with error/invalid styling. Defaults to `false`. */
  isInvalid?: boolean;
  /** Additional class names applied to the trigger button. */
  className?: string;
}

/**
 * Full-width outlined form-field trigger that opens the same deployment
 * selector overlay content (search, favorites, Browse) the chat input's
 * icon trigger opens, via `useDeploymentSelectorFieldOverlay`. Its own
 * selection is independent of the chat input's active deployment.
 */
const DeploymentSelectorFieldTrigger: FC<Props> = ({
  selectedId,
  onSelect,
  placeholder,
  labelledById,
  isDisabled = false,
  isInvalid = false,
  className,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const { renderOverlay, catalogModal, isLoading, error, resolvedLabel } =
    useDeploymentSelectorFieldOverlay(selectedId, (id) => {
      onSelect(id);
      setIsOpen(false);
    });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (isDisabled) return;
      setIsOpen(open);
    },
    [isDisabled],
  );

  const handleTriggerClick = useCallback(() => {
    handleOpenChange(!isOpen);
  }, [handleOpenChange, isOpen]);

  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [],
  );

  /*
   * `resolvedLabel` takes precedence once known — including its raw-id
   * fallback for an unresolved deployment — so a background refetch never
   * blanks out an already-displayed selection with the loading/error copy.
   * Loading/error text is shown only while nothing has resolved yet.
   */
  let displayLabel = resolvedLabel ?? placeholder;
  if (resolvedLabel == null) {
    if (isLoading) {
      displayLabel = t(DeploymentSelectorI18nKeys.Loading);
    } else if (error) {
      displayLabel = t(DeploymentSelectorI18nKeys.Error);
    }
  }

  return (
    <>
      <Dropdown
        open={isOpen}
        onOpenChange={handleOpenChange}
        trigger={[]}
        outsideClosable
        disabled={isDisabled}
        renderOverlay={() => renderOverlay(() => setIsOpen(false))}
        listClassName="cp-dropdown-overlay"
      >
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={labelledById}
          aria-invalid={isInvalid || undefined}
          disabled={isDisabled}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
          className={mergeClasses(
            'flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-primary bg-layer-base px-3 text-start text-primary',
            'hover:border-primary focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-focus-black',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isInvalid && 'border-error',
            className,
          )}
        >
          <span
            className={mergeClasses(
              'dial-small-text min-w-0 flex-1 truncate text-start',
              resolvedLabel == null && !isLoading && !error && 'text-secondary',
              error != null && 'text-error',
            )}
          >
            {displayLabel}
          </span>
          {isLoading ? (
            <Spinner
              size={DIAL_ICON_SIZE.SM}
              className="shrink-0"
              ariaLabel={t(DeploymentSelectorI18nKeys.Loading)}
            />
          ) : (
            // A vertical rotation is direction-agnostic (up/down does not
            // flip under RTL), so no `rtl:` mirroring class is needed here.
            <IconChevronDown
              size={DIAL_ICON_SIZE.SM}
              className={mergeClasses(
                'shrink-0 text-secondary transition-transform',
                isOpen && 'rotate-180',
              )}
              aria-hidden
            />
          )}
        </button>
      </Dropdown>
      {catalogModal}
    </>
  );
};

export default memo(DeploymentSelectorFieldTrigger);
