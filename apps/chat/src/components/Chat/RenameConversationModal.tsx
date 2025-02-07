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
import { notAllowedSymbolsRegex } from '@/src/utils/app/file';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { DISALLOW_INTERACTIONS } from '@/src/constants/modal';

import { ConfirmDialog } from '../Common/ConfirmDialog';
import { Modal } from '../Common/Modal';
import { withRenderWhen } from '../Common/RenderWhen';

function RenameConversationView() {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement>(null);

  const allConversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );

  const renamingConversation = useAppSelector(
    ConversationsSelectors.selectRenamingConversation,
  );

  const [newConversationName, setNewConversationName] = useState('');
  const [isConfirmRenaming, setIsConfirmRenaming] = useState(false);
  const [originConversationName, setOriginConversationName] = useState('');

  useEffect(() => {
    if (renamingConversation) {
      setNewConversationName(renamingConversation.name || '');
      setOriginConversationName(renamingConversation.name || '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    } else {
      setNewConversationName('');
      setOriginConversationName('');
      setIsConfirmRenaming(false);
    }
  }, [renamingConversation]);

  const newName = useMemo(
    () => prepareEntityName(newConversationName, { forRenaming: true }),
    [newConversationName],
  );

  const performRename = useCallback(
    (name: string) => {
      if (!name.trim()) return;
      if (name.length > 0 && renamingConversation) {
        dispatch(
          ConversationsActions.updateConversation({
            id: renamingConversation.id,
            values: {
              name,
              isNameChanged: true,
              isShared: false,
            },
          }),
        );
        dispatch(ConversationsActions.setRenamingConversationId(null));
      }
    },
    [renamingConversation, dispatch],
  );

  const handleRename = useCallback(() => {
    if (!renamingConversation) return;

    if (
      !isEntityNameOnSameLevelUnique(
        newName,
        renamingConversation,
        allConversations,
      )
    ) {
      dispatch(
        UIActions.showErrorToast(
          t(
            'Conversation with name "{{newName}}" already exists in this folder.',
            {
              ns: Translation.Chat,
              newName,
            },
          ),
        ),
      );

      return;
    }

    if (doesHaveDotsInTheEnd(newName)) {
      dispatch(
        UIActions.showErrorToast(
          t('Using a dot at the end of a name is not permitted.'),
        ),
      );
      return;
    }

    if (
      renamingConversation.isShared &&
      newName !== renamingConversation.name
    ) {
      setIsConfirmRenaming(true);
      return;
    }

    performRename(newName);
  }, [
    newName,
    renamingConversation,
    allConversations,
    performRename,
    dispatch,
    t,
  ]);

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
        {t('Rename conversation')}
      </h4>
      <input
        name="titleInput"
        type="text"
        ref={inputRef}
        value={newConversationName}
        onFocus={(e) => e.target.select()}
        onChange={(e) =>
          setNewConversationName(
            e.target.value.replaceAll(notAllowedSymbolsRegex, ''),
          )
        }
        onKeyDown={handleEnterDown}
        className="w-full rounded border border-primary bg-transparent px-3 py-2.5 leading-4 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
        autoComplete="off"
      />
      <div className="relative flex justify-end gap-3">
        <button
          className="button button-secondary py-2"
          onClick={handleClose}
          data-qa="cancel"
        >
          {t('Cancel')}
        </button>
        <button
          className="button button-primary py-2 disabled:cursor-not-allowed"
          onClick={handleRename}
          data-qa="save"
          disabled={
            !newConversationName.trim() ||
            newConversationName === originConversationName
          }
        >
          {t('Save')}
        </button>
      </div>
      <ConfirmDialog
        isOpen={isConfirmRenaming}
        heading={t('Confirm renaming conversation')}
        confirmLabel={t('Rename')}
        cancelLabel={t('Cancel')}
        description={t(
          'Renaming will stop sharing and other users will no longer see this conversation.',
        )}
        onClose={(result) => {
          setIsConfirmRenaming(false);
          if (result) performRename(newName);
          handleClose();
        }}
      />
    </Modal>
  );
}

export const RenameConversationModal = withRenderWhen(
  ConversationsSelectors.selectRenamingConversation,
)(RenameConversationView);
