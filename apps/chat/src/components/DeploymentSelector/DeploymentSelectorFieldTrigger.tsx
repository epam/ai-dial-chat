import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, Dropdown, Input, Spinner } from '@epam/ai-dial-ui-kit';
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

  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [],
  );

  /*
   * `resolvedLabel` (including its raw-id fallback for an unresolved
   * deployment) is rendered as the field's `value`, exactly like a real
   * selection would be — so a background refetch never blanks out an
   * already-displayed selection with loading/error copy. Loading/error text
   * only replaces the placeholder while nothing has resolved yet.
   */
  let effectivePlaceholder = placeholder;
  if (resolvedLabel == null) {
    if (isLoading) {
      effectivePlaceholder = t(DeploymentSelectorI18nKeys.Loading);
    } else if (error) {
      effectivePlaceholder = t(DeploymentSelectorI18nKeys.Error);
    }
  }

  return (
    <>
      <Dropdown
        open={isOpen}
        onOpenChange={handleOpenChange}
        outsideClosable
        disabled={isDisabled}
        renderOverlay={() => renderOverlay(() => setIsOpen(false))}
        listClassName="cp-dropdown-overlay !bg-layer-raised"
        className="w-full"
      >
        {/*
         * Built on the same `Input` component `Select` wraps in a `readOnly`
         * combobox (see `@epam/ai-dial-ui-kit` Select.tsx), so this trigger's
         * chrome (border, radius, height, focus/hover, colors) always stays
         * pixel-identical to every other field/dropdown in the app instead
         * of duplicating those styles by hand. Opening is handled by
         * `Dropdown`'s default click trigger (a click anywhere in the field,
         * including the chevron, toggles it via `onOpenChange`) — the same
         * way `Select` opens, rather than a manual `onClick` scoped to just
         * the `<input>` element, which the icon sits outside of.
         */}
        <Input
          readOnly
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={labelledById}
          disabled={isDisabled}
          invalid={isInvalid || Boolean(error)}
          value={resolvedLabel ?? ''}
          placeholder={effectivePlaceholder}
          onKeyDown={handleTriggerKeyDown}
          containerClassName="w-full"
          wrapperClassName={mergeClasses('cursor-pointer', className)}
          className="cursor-pointer"
          iconAfter={
            isLoading ? (
              <Spinner
                size={DIAL_ICON_SIZE.SM}
                ariaLabel={t(DeploymentSelectorI18nKeys.Loading)}
              />
            ) : (
              // A vertical rotation is direction-agnostic (up/down does not
              // flip under RTL), so no `rtl:` mirroring class is needed here.
              <IconChevronDown
                size={DIAL_ICON_SIZE.MD}
                className={mergeClasses(
                  'transition-transform',
                  isOpen && 'rotate-180',
                )}
                aria-hidden
              />
            )
          }
        />
      </Dropdown>
      {catalogModal}
    </>
  );
};

export default memo(DeploymentSelectorFieldTrigger);
