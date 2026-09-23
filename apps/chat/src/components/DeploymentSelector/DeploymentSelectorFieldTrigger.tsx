import { DeploymentSelectorField } from '@epam/ai-dial-catalog';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { BottomSheetShell } from '@epam/ai-dial-conversation-input';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { memo, useCallback, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { DeploymentSelectorI18nKeys } from '../../constants/translation-keys';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import type { DeploymentSelectorExtraOption } from './DeploymentSelectorPanel';
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
  /**
   * Non-deployment rows pinned above the panel's catalog sections, e.g. the
   * mode sentinels of the default-agent preference. Their ids flow through
   * `onSelect` and `selectedId` exactly like a deployment id does, and the
   * field resolves its own label from them.
   */
  extraOptions?: DeploymentSelectorExtraOption[];
  /** Additional classes merged over the selector panel root's defaults. */
  panelClassName?: string;
}

/**
 * Full-width outlined form-field trigger that opens the same deployment
 * selector overlay content (search, favorites, Browse) the chat input's
 * icon trigger opens, via `useDeploymentSelectorFieldOverlay`. Its own
 * selection is independent of the chat input's active deployment. On
 * desktop the overlay opens as a dropdown popover; on mobile as a bottom
 * sheet — the same `BottomSheetShell` the chat page's picker uses.
 */
const DeploymentSelectorFieldTrigger: FC<Props> = ({
  selectedId,
  onSelect,
  placeholder,
  labelledById,
  isDisabled = false,
  isInvalid = false,
  className,
  extraOptions,
  panelClassName,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  /* One open state shared by both presentations (only one is ever mounted).
   * Crossing the breakpoint while open — device rotation — intentionally
   * keeps it open: the picker continues in the other presentation instead
   * of dismissing the user mid-selection. */
  const [isOpen, setIsOpen] = useState(false);

  const { renderOverlay, catalogModal, isLoading, error, resolvedLabel } =
    useDeploymentSelectorFieldOverlay(
      selectedId,
      (id) => {
        onSelect(id);
        setIsOpen(false);
      },
      extraOptions,
      mergeClasses('min-w-0', panelClassName),
    );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (isDisabled) return;
      setIsOpen(open);
    },
    [isDisabled],
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
      <DeploymentSelectorField
        selectedId={selectedId}
        selectedLabel={resolvedLabel}
        records={[]}
        placeholder={effectivePlaceholder}
        labels={{
          searchPlaceholder: t(DeploymentSelectorI18nKeys.SearchPlaceholder),
          searchAriaLabel: t(DeploymentSelectorI18nKeys.AriaLabel),
          emptyLabel: t(DeploymentSelectorI18nKeys.EmptyHint),
          errorLabel: t(DeploymentSelectorI18nKeys.Error),
        }}
        onSelect={onSelect}
        isLoading={isLoading}
        error={error}
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        labelledById={labelledById}
        ariaHasPopup={isMobile ? 'dialog' : 'listbox'}
        className={className}
        panelClassName={panelClassName}
        iconAfter={
          isLoading ? (
            <Spinner
              size={DIAL_ICON_SIZE.SM}
              ariaLabel={t(DeploymentSelectorI18nKeys.Loading)}
            />
          ) : (
            <IconChevronDown
              size={DIAL_ICON_SIZE.MD}
              className={mergeClasses(
                'transition-transform',
                isOpen && 'rotate-180',
              )}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          )
        }
        open={isOpen}
        onOpenChange={handleOpenChange}
        renderPanel={renderOverlay}
        renderOverlay={
          isMobile
            ? (panel, open, close) => (
                <BottomSheetShell
                  isOpen={open}
                  title={t(DeploymentSelectorI18nKeys.AriaLabel)}
                  closeLabel={t(DeploymentSelectorI18nKeys.CloseLabel)}
                  onClose={close}
                  className="max-h-[90dvh]"
                >
                  {panel}
                </BottomSheetShell>
              )
            : undefined
        }
      />
      {catalogModal}
    </>
  );
};

export default memo(DeploymentSelectorFieldTrigger);
