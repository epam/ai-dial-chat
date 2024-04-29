import { IconClipboard, IconClipboardX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { FolderSectionProps } from '@/src/types/folder';
import {
  Publication,
  PublicationInfo,
  PublicationStatus,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ConversationComponent } from '../../Chatbar/Conversation';
import CaretIconComponent from '../../Common/CaretIconComponent';
import CollapsibleSection from '../../Common/CollapsibleSection';
import Folder from '../../Folder/Folder';

export const PublicationItem = ({
  publication,
  status,
}: {
  publication: PublicationInfo & Partial<Publication>;
  status: PublicationStatus;
}) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Chat),
  );
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const publicationFolders = useAppSelector(
    ConversationsSelectors.selectPublicationFolders,
  );
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);

  const [isOpen, setIsOpen] = useState(false);

  const PublicationIcon =
    status === PublicationStatus.PENDING ? IconClipboard : IconClipboardX;

  return (
    <>
      <div
        onClick={() => {
          setIsOpen(true);
          if (!isOpen) {
            dispatch(
              PublicationActions.uploadPublication({ url: publication.url }),
            );
          } else {
            dispatch(
              PublicationActions.selectPublication({
                publication: publication as Publication,
              }),
            );
          }

          dispatch(
            ConversationsActions.selectConversations({
              conversationIds: [],
            }),
          );
        }}
        className="group relative flex h-[30px] items-center rounded hover:bg-accent-primary-alpha"
      >
        <div className="group/button flex size-full cursor-pointer items-center gap-1 py-2 pr-3">
          <CaretIconComponent isOpen={isOpen} />
          <PublicationIcon width={18} height={18} />
          <div
            className="relative max-h-5 flex-1 truncate break-all text-left"
            data-qa="folder-name"
          >
            {publication.url.split('/').slice(-1).shift()}
          </div>
        </div>
      </div>
      {!!publication.resources &&
        isOpen &&
        publication.resources.map((p) => {
          const folders = publicationFolders.filter((f) =>
            p.reviewUrl.startsWith(f.folderId),
          );
          const rootFolder = folders.find((f) => isRootId(f.folderId));

          if (!rootFolder) {
            return null;
          }

          return (
            <Folder
              readonly
              level={1}
              key={p.reviewUrl}
              currentFolder={rootFolder}
              allFolders={folders}
              searchTerm={searchTerm}
              openedFoldersIds={openedFoldersIds}
              allItems={conversations}
              itemComponent={ConversationComponent}
              onClickFolder={(folderId: string) => {
                dispatch(ConversationsActions.toggleFolder({ id: folderId }));
              }}
              featureType={FeatureType.Chat}
            />
          );
        })}
    </>
  );
};

export const ApproveRequiredSection = ({
  name,
  displayRootFiles,
  openByDefault = false,
  dataQa,
}: Omit<FolderSectionProps, 'filters'>) => {
  const { t } = useTranslation(Translation.SideBar);

  const pendingPublications = useAppSelector(
    PublicationSelectors.selectPendingPublications,
  );
  const requestedForDeletionPublications = useAppSelector(
    PublicationSelectors.selectRequestedForDeletionPublications,
  );
  const selectedFoldersIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);

  useEffect(() => {
    // const shouldBeHighlighted =
    //   rootFolders.some((folder) => selectedFoldersIds.includes(folder.id)) ||
    //   (!!displayRootFiles &&
    //     sortedRootConversations.some((conv) =>
    //       selectedConversationsIds.includes(conv.id),
    //     ));
    // if (isSectionHighlighted !== shouldBeHighlighted) {
    //   setIsSectionHighlighted(shouldBeHighlighted);
    // }
  }, [
    displayRootFiles,
    // rootFolders,
    isSectionHighlighted,
    selectedConversationsIds,
    selectedFoldersIds,
    // rootConversations,
    // sortedRootConversations,
  ]);

  return (
    <CollapsibleSection
      name={t(name)}
      openByDefault={openByDefault}
      dataQa={dataQa}
      isHighlighted={isSectionHighlighted}
    >
      {pendingPublications.map((p) => (
        <PublicationItem
          status={PublicationStatus.PENDING}
          key={p.url}
          publication={p}
        />
      ))}
      {!!requestedForDeletionPublications.length && (
        <div>RequestedForDeletion</div>
      )}
    </CollapsibleSection>
  );
};
