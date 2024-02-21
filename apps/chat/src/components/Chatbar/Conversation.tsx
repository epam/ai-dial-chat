import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { IconCheck, IconX } from '@tabler/icons-react';
import {
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  isEntityNameOnSameLevelUnique,
  prepareEntityName,
} from '@/src/utils/app/common';
import { constructPath, notAllowedSymbolsRegex } from '@/src/utils/app/file';
import { getNextDefaultName } from '@/src/utils/app/folders';
import { getRootId, isRootId } from '@/src/utils/app/id';
import { hasParentWithFloatingOverlay } from '@/src/utils/app/modals';
import { MoveType, getDragImage } from '@/src/utils/app/move';
import { defaultMyItemsFilters } from '@/src/utils/app/search';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';
import { ApiKeys } from '@/src/utils/server/api';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import {
  BackendDataNodeType,
  BackendResourceType,
  FeatureType,
  isNotLoaded,
} from '@/src/types/common';
import { MoveToFolderProps } from '@/src/types/folder';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-settings';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import ItemContextMenu from '@/src/components/Common/ItemContextMenu';
import { MoveToFolderMobileModal } from '@/src/components/Common/MoveToFolderMobileModal';
import ShareIcon from '@/src/components/Common/ShareIcon';

import PublishModal from '../Chat/Publish/PublishWizard';
import UnpublishModal from '../Chat/UnpublishModal';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { ExportModal } from './ExportModal';
import { ModelIcon } from './ModelIcon';

interface ViewProps {
  conversation: ConversationInfo;
  isHighlited: boolean;
}

export function ConversationView({ conversation, isHighlited }: ViewProps) {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <>
      <ShareIcon
        {...conversation}
        isHighlighted={isHighlited}
        featureType={FeatureType.Chat}
      >
        {conversation.isReplay && (
          <span className="flex shrink-0">
            <ReplayAsIsIcon size={18} />
          </span>
        )}

        {conversation.isPlayback && (
          <span className="flex shrink-0">
            <PlaybackIcon size={18} />
          </span>
        )}

        {!conversation.isReplay && !conversation.isPlayback && (
          <ModelIcon
            size={18}
            entityId={conversation.model.id}
            entity={modelsMap[conversation.model.id]}
          />
        )}
      </ShareIcon>
      <div
        className="relative max-h-5 flex-1 truncate break-all text-left"
        data-qa="chat-name"
      >
        {conversation.name}
      </div>
    </>
  );
}

interface Props {
  item: ConversationInfo;
  level?: number;
}

export const ConversationComponent = ({ item: conversation, level }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const folders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredFolders(
      state,
      defaultMyItemsFilters,
      '',
      true,
    ),
  );
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
  const isExternal = useAppSelector((state) =>
    isEntityOrParentsExternal(state, conversation, FeatureType.Chat),
  );
  const allConversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const [isShowExportModal, setIsShowExportModal] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isContextMenu, setIsContextMenu] = useState(false);
  const [isConfirmRenaming, setIsConfirmRenaming] = useState(false);
  const [isUnshareConfirmOpened, setIsUnshareConfirmOpened] = useState(false);

  const isSelected = selectedConversationIds.includes(conversation.id);

  const { refs, context } = useFloating({
    open: isContextMenu,
    onOpenChange: setIsContextMenu,
  });

  useEffect(() => {
    if (isContextMenu && isNotLoaded(conversation.status)) {
      dispatch(
        ConversationsActions.uploadConversationsByIds({
          conversationIds: [conversation.id],
        }),
      );
    }
  }, [conversation.id, conversation.status, dispatch, isContextMenu]);

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  const isEmptyConversation = !(
    (conversation as Conversation).messages?.length > 0
  );

  const performRename = useCallback(
    (name: string, removeShareIcon?: boolean) => {
      if (name.length > 0) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              name,
              isNameChanged: true,
              isShared: removeShareIcon ? false : conversation.isShared,
            },
          }),
        );

        setRenameValue('');
        setIsContextMenu(false);
      }

      setIsRenaming(false);
    },
    [conversation.id, conversation.isShared, dispatch],
  );

  const handleRename = useCallback(
    (conversation: ConversationInfo) => {
      const newName = prepareEntityName(renameValue, true);
      setRenameValue(newName);

      if (
        !isEntityNameOnSameLevelUnique(newName, conversation, allConversations)
      ) {
        dispatch(
          UIActions.showToast({
            message: t(
              'Conversation with name "{{newName}}" already exists in this folder.',
              {
                ns: 'chat',
                newName,
              },
            ),
            type: 'error',
          }),
        );

        return;
      }

      if (newName !== conversation.name) {
        setIsConfirmRenaming(true);
      } else {
        setRenameValue('');
        setIsContextMenu(false);
        setIsRenaming(false);
      }
    },
    [allConversations, dispatch, renameValue, t],
  );

  const handleEnterDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRename(conversation);
      }
    },
    [conversation, handleRename],
  );

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>, conversation: ConversationInfo) => {
      if (e.dataTransfer && !isExternal) {
        e.dataTransfer.setDragImage(getDragImage(), 0, 0);
        e.dataTransfer.setData(
          MoveType.Conversation,
          JSON.stringify(conversation),
        );
      }
    },
    [isExternal],
  );

  const handleConfirm: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      if (isDeleting) {
        if (conversation.sharedWithMe) {
          dispatch(
            ShareActions.discardSharedWithMe({
              resourceId: conversation.id,
              nodeType: BackendDataNodeType.ITEM,
              resourceType: BackendResourceType.CONVERSATION,
            }),
          );
        } else {
          dispatch(
            ConversationsActions.deleteConversations({
              conversationIds: [conversation.id],
            }),
          );
        }
        setIsDeleting(false);
      } else if (isRenaming) {
        handleRename(conversation);
      }
    },
    [conversation, dispatch, handleRename, isDeleting, isRenaming],
  );

  const handleCancel: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsDeleting(false);
      setIsRenaming(false);
    },
    [],
  );

  const handleStartRename: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsRenaming(true);
      setRenameValue(conversation.name);
    },
    [conversation.name],
  );
  const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> =
    useCallback((e) => {
      e.stopPropagation();
      setIsDeleting(true);
    }, []);

  const handleStartReplay: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsContextMenu(false);
      dispatch(ConversationsActions.createNewReplayConversation(conversation));
    },
    [conversation, dispatch],
  );

  const handleCreatePlayback: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      dispatch(
        ConversationsActions.createNewPlaybackConversation(conversation),
      );
      setIsContextMenu(false);
    }, [conversation, dispatch]);

  const handleCompare: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      if (isReplay || isPlayback) return;
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [conversation.id],
        }),
      );
      dispatch(UIActions.setIsCompareMode(true));
    }, [conversation.id, dispatch, isPlayback, isReplay]);

  const handleDuplicate: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      setIsContextMenu(false);
      dispatch(ConversationsActions.duplicateConversation(conversation));
    },
    [conversation, dispatch],
  );

  useEffect(() => {
    if (isRenaming) {
      setIsDeleting(false);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }); // set auto-focus
    } else if (isDeleting) {
      setIsRenaming(false);
    }
  }, [isRenaming, isDeleting]);

  const handleOpenSharing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      dispatch(
        ShareActions.share({
          resourceType: BackendResourceType.CONVERSATION,
          resourceId: conversation.id,
          nodeType: BackendDataNodeType.ITEM,
        }),
      );
      setIsContextMenu(false);
    }, [conversation.id, dispatch]);

  const handleUnshare: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsUnshareConfirmOpened(true);
      setIsContextMenu(false);
    }, []);

  const handleOpenPublishing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsPublishing(true);
      setIsContextMenu(false);
    }, []);

  const handleClosePublishModal = useCallback(() => {
    setIsPublishing(false);
  }, []);

  const handleOpenUnpublishing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsUnpublishing(true);
      setIsContextMenu(false);
    }, []);

  const handleCloseUnpublishModal = useCallback(() => {
    setIsUnpublishing(false);
  }, []);

  const handleMoveToFolder = useCallback(
    ({ folderId, isNewFolder }: MoveToFolderProps) => {
      const folderPath = (
        isNewFolder
          ? getNextDefaultName(
              translate(DEFAULT_FOLDER_NAME),
              folders.filter((f) => isRootId(f.folderId)),
            )
          : folderId
      ) as string;

      if (
        !isEntityNameOnSameLevelUnique(
          conversation.name,
          { ...conversation, folderId: folderPath },
          allConversations,
        )
      ) {
        dispatch(
          UIActions.showToast({
            message: t(
              'Conversation with name "{{name}}" already exists in this folder.',
              {
                ns: 'chat',
                name: conversation.name,
              },
            ),
            type: 'error',
          }),
        );

        return;
      }

      if (isNewFolder) {
        dispatch(
          ConversationsActions.createFolder({
            name: folderPath,
            parentId: getRootId({ apiKey: ApiKeys.Conversations }),
          }),
        );
      }
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: {
            folderId: isNewFolder
              ? constructPath(
                  getRootId({ apiKey: ApiKeys.Conversations }),
                  folderPath,
                )
              : folderPath,
          },
        }),
      );
    },
    [allConversations, conversation, dispatch, folders, t],
  );
  const handleOpenExportModal = useCallback(() => {
    setIsShowExportModal(true);
  }, []);
  const handleCloseExportModal = useCallback(() => {
    setIsShowExportModal(false);
  }, []);

  const handleExport = useCallback(
    (args?: unknown) => {
      const typedArgs = args as { withAttachments?: boolean };
      if (typedArgs?.withAttachments) {
        dispatch(
          ImportExportActions.exportConversation({
            conversationId: conversation.id,
            withAttachments: true,
          }),
        );
      } else {
        dispatch(
          ImportExportActions.exportConversation({
            conversationId: conversation.id,
          }),
        );
      }
      handleCloseExportModal();
    },
    [conversation.id, dispatch, handleCloseExportModal],
  );

  const handleContextMenuOpen = (e: MouseEvent) => {
    if (hasParentWithFloatingOverlay(e.target as Element)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenu(true);
  };

  const isHighlighted = isSelected || isRenaming || isDeleting;

  return (
    <div
      className={classNames(
        'group relative flex h-[30px] items-center rounded border-l-2 pr-3 hover:bg-accent-primary-alpha',
        isHighlighted
          ? 'border-l-accent-primary bg-accent-primary-alpha'
          : 'border-l-transparent',
        { 'bg-accent-primary-alpha': isContextMenu },
      )}
      style={{
        paddingLeft: (level && `${0.875 + level * 1.5}rem`) || '0.875rem',
      }}
      onContextMenu={handleContextMenuOpen}
      data-qa="conversation"
    >
      {isRenaming ? (
        <div className="flex w-full items-center gap-2 pr-12">
          <ShareIcon
            {...conversation}
            isHighlighted={isHighlighted}
            featureType={FeatureType.Chat}
          >
            {conversation.isReplay && (
              <span className="flex shrink-0">
                <ReplayAsIsIcon size={18} />
              </span>
            )}

            {conversation.isPlayback && (
              <span className="flex shrink-0">
                <PlaybackIcon size={18} />
              </span>
            )}

            {!conversation.isReplay && !conversation.isPlayback && (
              <ModelIcon
                size={18}
                entityId={conversation.model.id}
                entity={modelsMap[conversation.model.id]}
              />
            )}
          </ShareIcon>
          <input
            className="flex-1 overflow-hidden text-ellipsis bg-transparent text-left outline-none"
            type="text"
            value={renameValue}
            onChange={(e) =>
              setRenameValue(
                e.target.value.replaceAll(notAllowedSymbolsRegex, ''),
              )
            }
            onKeyDown={handleEnterDown}
            autoFocus
            ref={inputRef}
          />
        </div>
      ) : (
        <button
          className={classNames(
            'group flex size-full cursor-pointer items-center gap-2 transition-colors duration-200',
            messageIsStreaming && 'disabled:cursor-not-allowed',
            isDeleting && 'pr-12',
            !messageIsStreaming && !isDeleting && 'group-hover:pr-6',
            isSelected && 'pr-0',
          )}
          onClick={() => {
            setIsDeleting(false);
            setIsRenaming(false);
            dispatch(
              ConversationsActions.selectConversations({
                conversationIds: [conversation.id],
              }),
            );
          }}
          disabled={messageIsStreaming}
          draggable={!isExternal}
          onDragStart={(e) => handleDragStart(e, conversation)}
          ref={buttonRef}
        >
          <ConversationView
            conversation={conversation}
            isHighlited={isHighlighted || isContextMenu}
          />
        </button>
      )}

      {!isDeleting && !isRenaming && !messageIsStreaming && (
        <div
          ref={refs.setFloating}
          {...getFloatingProps()}
          className={classNames(
            'invisible absolute right-3 z-50 flex justify-end group-hover:visible',
          )}
          data-qa="dots-menu"
        >
          <ItemContextMenu
            entity={conversation}
            isEmptyConversation={isEmptyConversation}
            folders={folders}
            featureType={FeatureType.Chat}
            onOpenMoveToModal={() => {
              setIsShowMoveToModal(true);
            }}
            onMoveToFolder={handleMoveToFolder}
            onDelete={handleOpenDeleteModal}
            onRename={handleStartRename}
            onExport={handleExport}
            onOpenExportModal={handleOpenExportModal}
            onCompare={!isReplay && !isPlayback ? handleCompare : undefined}
            onDuplicate={handleDuplicate}
            onReplay={!isPlayback ? handleStartReplay : undefined}
            onPlayback={handleCreatePlayback}
            onShare={handleOpenSharing}
            onUnshare={handleUnshare}
            onPublish={handleOpenPublishing}
            onPublishUpdate={handleOpenPublishing}
            onUnpublish={handleOpenUnpublishing}
            onOpenChange={setIsContextMenu}
            isOpen={isContextMenu}
          />
        </div>
      )}
      <div className="md:hidden">
        {isShowMoveToModal && (
          <MoveToFolderMobileModal
            onClose={() => {
              setIsShowMoveToModal(false);
            }}
            folders={folders}
            onMoveToFolder={handleMoveToFolder}
          />
        )}
      </div>
      <div className="md:hidden">
        {isShowExportModal && (
          <ExportModal
            onExport={handleExport}
            onClose={handleCloseExportModal}
            isOpen={isShowExportModal}
          />
        )}
      </div>

      {(isDeleting || isRenaming) && (
        <div className="absolute right-1 z-10 flex">
          <SidebarActionButton handleClick={handleConfirm}>
            <IconCheck size={18} className="hover:text-accent-primary" />
          </SidebarActionButton>
          <SidebarActionButton handleClick={handleCancel}>
            <IconX
              size={18}
              strokeWidth="2"
              className="hover:text-accent-primary"
            />
          </SidebarActionButton>
        </div>
      )}
      {isPublishing && (
        <PublishModal
          entity={conversation}
          type={SharingType.Conversation}
          isOpen
          onClose={handleClosePublishModal}
        />
      )}
      {isUnpublishing && (
        <UnpublishModal
          entity={conversation}
          type={SharingType.Conversation}
          isOpen
          onClose={handleCloseUnpublishModal}
        />
      )}
      {isUnshareConfirmOpened && (
        <ConfirmDialog
          isOpen={isUnshareConfirmOpened}
          heading={t('Confirm revoking access to {{conversationName}}', {
            conversationName: conversation.name,
          })}
          description={
            t(
              'Are you sure that you want to revoke access to this conversation?',
            ) || ''
          }
          confirmLabel={t('Revoke access')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            setIsUnshareConfirmOpened(false);
            if (result) {
              dispatch(
                ShareActions.revokeAccess({
                  resourceId: conversation.id,
                  nodeType: BackendDataNodeType.ITEM,
                  resourceType: BackendResourceType.CONVERSATION,
                }),
              );
            }
          }}
        />
      )}
      <ConfirmDialog
        isOpen={isConfirmRenaming}
        heading={t('Confirm renaming')}
        confirmLabel={t('Rename')}
        cancelLabel={t('Cancel')}
        description={
          conversation.isShared &&
          t(
            'Renaming will stop sharing and other users will no longer see this conversation.',
          )
        }
        onClose={(result) => {
          setIsConfirmRenaming(false);
          if (result) {
            performRename(prepareEntityName(renameValue, true), true);
          }
        }}
      />
    </div>
  );
};
