import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  doesHaveDotsInTheEnd,
  isEntityNameOnSameLevelUnique,
  prepareEntityName,
} from '@/src/utils/app/common';
import { getAvailableConversationNameBytes } from '@/src/utils/app/conversation';
import { notAllowedSymbolsRegex } from '@/src/utils/app/file';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ConversationsActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DISALLOW_INTERACTIONS } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

import { ConversationInfo } from '@epam/ai-dial-shared';
import {
  DialInput,
  DialNeutralButton,
  DialPrimaryButton,
} from '@epam/ai-dial-ui-kit';

interface RenameConversationViewProps {
  renamingConversation: ConversationInfo;
}

const view = withRenderWhenEntities<RenameConversationViewProps>({
  renamingConversation: ConversationsSelectors.selectRenamingConversation,
})(({ renamingConversation }: RenameConversationViewProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const allConversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );

  const [newConversationName, setNewConversationName] = useState('');
  const [originConversationName, setOriginConversationName] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNewConversationName(renamingConversation.name || '');
    setOriginConversationName(renamingConversation.name || '');
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [renamingConversation]);

  const availableNameBytes = useMemo(
    () => getAvailableConversationNameBytes(renamingConversation),
    [renamingConversation],
  );

  const newName = useMemo(
    () =>
      prepareEntityName(newConversationName, {
        forRenaming: true,
        maxNameLength: availableNameBytes,
      }),
    [newConversationName, availableNameBytes],
  );

  const handleRename = useCallback(() => {
    if (
      !isEntityNameOnSameLevelUnique(
        newName,
        renamingConversation,
        allConversations,
      )
    ) {
      dispatch(
        UIActions.showErrorToast({
          message: t(ChatI18nKeys.ConversationNameExistsInFolder, {
            ns: Translation.Chat,
            newName,
          }),
        }),
      );

      return;
    }

    if (doesHaveDotsInTheEnd(newName)) {
      dispatch(
        UIActions.showErrorToast({
          message: t(ChatI18nKeys.DotAtEndNotPermitted),
        }),
      );
      return;
    }

    if (newName.length > 0) {
      dispatch(
        ConversationsActions.updateConversation({
          id: renamingConversation.id,
          values: { name: newName },
          publicationUrl: renamingConversation.publicationInfo?.publicationUrl,
        }),
      );
      dispatch(ConversationsActions.setRenamingConversationId(null));
    }
  }, [renamingConversation, newName, allConversations, dispatch, t]);

  const handleEnterDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleRename();
      }
    },
    [handleRename],
  );

  const handleClose = useCallback(() => {
    dispatch(ConversationsActions.setRenamingConversationId(null));
  }, [dispatch]);

  return (
    <Modal
      dataQa="rename-conversation-modal"
      onClose={handleClose}
      state={ModalState.OPENED}
      portalId="theme-main"
      containerClassName="inline-block max-w-[400px] w-full p-6 rounded flex gap-4 flex-col"
      dismissProps={DISALLOW_INTERACTIONS}
      hideClose
    >
      <h4 className="text-base font-semibold" data-qa="title">
        {t(ChatI18nKeys.RenameConversation)}
      </h4>

      <DialInput
        name="titleInput"
        type="text"
        inputRef={inputRef}
        value={newConversationName}
        onFocus={(e) => e.target.select()}
        onChange={(value) =>
          setNewConversationName(
            value?.replaceAll(notAllowedSymbolsRegex, '') ?? '',
          )
        }
        onKeyDown={handleEnterDown}
      />

      <div className="relative flex justify-end gap-3">
        <DialNeutralButton
          onClick={handleClose}
          data-qa="cancel"
          label={t(ChatI18nKeys.Cancel)}
        />

        <DialPrimaryButton
          label={t(ChatI18nKeys.Save)}
          onClick={handleRename}
          data-qa="save"
          disabled={
            !newConversationName.trim() ||
            newConversationName === originConversationName
          }
        />
      </div>
    </Modal>
  );
});

export const RenameConversationModal = view;
