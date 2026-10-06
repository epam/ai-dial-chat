import {
  ConfirmationIdentityCard,
  ConfirmationIdentityRow,
  ConfirmationView,
} from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CONFIRMATION_BOLD_COMPONENTS } from '../../constants/confirmation-copy';
import {
  BasicI18nKeys,
  DialFileManagerI18nKeys,
} from '../../constants/translation-keys';

/*
 * The file manager lists the selection rather than showing a card per item,
 * so a long selection cannot push the actions off screen. Ten is what the
 * grid's own confirmation showed before this content block replaced it.
 */
const MAX_LISTED_NAMES = 10;

interface Props {
  /** Paths of the files and folders about to be deleted, as the grid reports them. */
  names: string[];
}

/**
 * Body of the file manager's delete confirmation, matching the block every
 * other delete surface shows. The dialog frame and its actions belong to
 * `@epam/ai-dial-react-file-manager`, which takes this as its
 * `contentRenderer`.
 */
const FileDeleteConfirmContent: FC<Props> = ({ names }) => {
  const { t } = useTranslation();

  const isSingle = names.length === 1;
  /* The grid reports full paths; the dialog names the item, not its location. */
  const displayNames = names.map((name) => name.split('/').pop() ?? name);
  const listedNames = displayNames.slice(0, MAX_LISTED_NAMES);
  const restCount = displayNames.length - listedNames.length;

  return (
    <ConfirmationView
      variant={ConfirmationPopupVariant.Danger}
      identity={
        <ConfirmationIdentityCard variant={ConfirmationPopupVariant.Danger}>
          {/* Name only, per design: no glyph and no type label. */}
          <ConfirmationIdentityRow
            name={
              isSingle
                ? displayNames[0]
                : t(DialFileManagerI18nKeys.DeleteConfirmItemCount, {
                    count: names.length,
                  })
            }
          />
        </ConfirmationIdentityCard>
      }
      message={
        <>
          {isSingle ? (
            <Trans
              i18nKey={DialFileManagerI18nKeys.DeleteConfirmMessageSingle}
              values={{ name: displayNames[0] }}
              components={CONFIRMATION_BOLD_COMPONENTS}
            />
          ) : (
            <Trans
              i18nKey={DialFileManagerI18nKeys.DeleteConfirmMessageMultiple}
              values={{ count: names.length }}
              components={CONFIRMATION_BOLD_COMPONENTS}
            />
          )}
          {!isSingle && (
            <ul className="mt-3 flex flex-col gap-1">
              {listedNames.map((name) => (
                <li key={name} className="truncate">
                  {name}
                </li>
              ))}
              {restCount > 0 && (
                <li className="text-secondary">
                  {t(DialFileManagerI18nKeys.DeleteConfirmMoreItems, {
                    count: restCount,
                  })}
                </li>
              )}
            </ul>
          )}
        </>
      }
      consequences={[t(BasicI18nKeys.ConsequenceCannotBeUndone)]}
    />
  );
};

export default memo(FileDeleteConfirmContent);
