import {
  ConfirmationDialog,
  ConfirmationIdentityRow,
  ResourceSummary,
} from '@epam/ai-dial-chat-shared';
import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CONFIRMATION_BOLD_COMPONENTS } from '../../constants/confirmation-copy';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
} from '../../constants/translation-keys';

/* Same cap as the delete confirmation's list, so both dialogs stay the same height. */
const MAX_LISTED_NAMES = 10;

interface UnshareController {
  onUnshareFiles: (files: DialFile[]) => void;
}

interface UseFileUnshareConfirmationResult<T extends UnshareController> {
  /** The controller with `onUnshareFiles` held back until the user confirms. */
  controller: T;
  /** The confirmation dialog; render it next to the file manager. */
  unshareConfirmation: ReactNode;
}

/**
 * Asks for confirmation before the file manager unshares shared-with-me
 * items. The file manager itself unshares as soon as the action is clicked,
 * so the host wraps its controller with this and renders the returned dialog.
 */
export const useFileUnshareConfirmation = <T extends UnshareController>(
  controller: T,
): UseFileUnshareConfirmationResult<T> => {
  const { t } = useTranslation();
  const [pendingItems, setPendingItems] = useState<DialFile[] | null>(null);
  const { onUnshareFiles } = controller;

  const requestUnshare = useCallback(
    (files: DialFile[]) => setPendingItems(files),
    [],
  );

  const handleConfirm = useCallback(() => {
    if (pendingItems != null) onUnshareFiles(pendingItems);
    setPendingItems(null);
  }, [pendingItems, onUnshareFiles]);

  const handleClose = useCallback(() => setPendingItems(null), []);

  const wrappedController = useMemo(
    () => ({ ...controller, onUnshareFiles: requestUnshare }),
    [controller, requestUnshare],
  );

  const items = pendingItems ?? [];
  /* Copy is only built while the dialog is open, so a closed dialog costs nothing per render. */
  const isSingle = items.length === 1;
  const listedItems = items.slice(0, MAX_LISTED_NAMES);
  const restCount = items.length - listedItems.length;

  let title = t(DialFileManagerI18nKeys.UnshareConfirmTitleMultiple);
  if (isSingle) {
    title =
      items[0].nodeType === DialFileNodeType.FOLDER
        ? t(DialFileManagerI18nKeys.UnshareConfirmTitleFolder)
        : t(DialFileManagerI18nKeys.UnshareConfirmTitleFile);
  }

  const unshareConfirmation =
    pendingItems == null ? null : (
      <ConfirmationDialog
        open
        title={title}
        variant={ConfirmationPopupVariant.Danger}
        identity={
          <ResourceSummary>
            <ConfirmationIdentityRow
              name={
                isSingle
                  ? items[0].name
                  : t(DialFileManagerI18nKeys.DeleteConfirmItemCount, {
                      count: items.length,
                    })
              }
            />
          </ResourceSummary>
        }
        message={
          isSingle ? (
            <Trans
              i18nKey={DialFileManagerI18nKeys.UnshareConfirmMessageSingle}
              values={{ name: items[0].name }}
              components={CONFIRMATION_BOLD_COMPONENTS}
            />
          ) : (
            <>
              <Trans
                i18nKey={DialFileManagerI18nKeys.UnshareConfirmMessageMultiple}
                values={{ count: items.length }}
                components={CONFIRMATION_BOLD_COMPONENTS}
              />
              <ul className="mt-3 flex flex-col gap-1">
                {listedItems.map((item) => (
                  <li key={item.id ?? item.path} className="truncate">
                    {item.name}
                  </li>
                ))}
                {restCount > 0 && (
                  <li className="text-secondary">
                    {t(DialFileManagerI18nKeys.UnshareConfirmMoreItems, {
                      count: restCount,
                    })}
                  </li>
                )}
              </ul>
            </>
          )
        }
        consequences={[t(BasicI18nKeys.ConsequenceCannotBeUndone)]}
        confirmLabel={t(DialFileManagerI18nKeys.UnshareAction)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

  return { controller: wrappedController, unshareConfirmation };
};
