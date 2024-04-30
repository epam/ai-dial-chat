import { IconClipboard, IconClipboardX } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isRootId } from '@/src/utils/app/id';

import { BackendResourceType, FeatureType } from '@/src/types/common';
import { FolderInterface, FolderSectionProps } from '@/src/types/folder';
import {
  Publication,
  PublicationInfo,
  PublicationResource,
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

import { some, uniqBy } from 'lodash-es';

const PublicationResources = ({
  resources,
}: {
  resources: PublicationResource[];
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
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

  const resourceUrls = useMemo(
    () => resources.map((r) => r.reviewUrl),
    [resources],
  );
  const conversationsToDisplay = useMemo(() => {
    return conversations.filter(
      (c) => c.folderId.split('/').length === 2 && resourceUrls.includes(c.id),
    );
  }, [conversations, resourceUrls]);

  const rootFolders = useMemo(() => {
    const folders = resources.map((resource) => {
      const relevantFolders = publicationFolders.filter((folder) =>
        resource.reviewUrl.startsWith(folder.id),
      );

      return relevantFolders.find((folder) => isRootId(folder.folderId));
    });

    const existingFolders = folders.filter(Boolean) as FolderInterface[];

    return uniqBy(existingFolders, 'id');
  }, [publicationFolders, resources]);

  return (
    <>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            level={1}
            key={f.id}
            currentFolder={f}
            allFolders={rootFolders}
            searchTerm={searchTerm}
            openedFoldersIds={openedFoldersIds}
            allItems={conversations}
            itemComponent={ConversationComponent}
            onClickFolder={(folderId: string) => {
              dispatch(ConversationsActions.toggleFolder({ id: folderId }));
            }}
            featureType={FeatureType.Chat}
            highlightedFolders={highlightedFolders}
          />
        );
      })}
      {conversationsToDisplay.map((c) => (
        <ConversationComponent key={c.id} item={c} level={1} />
      ))}
    </>
  );
};

const PublicationItem = ({
  publication,
  status,
}: {
  publication: PublicationInfo & Partial<Publication>;
  status: PublicationStatus;
}) => {
  const dispatch = useAppDispatch();

  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

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
        className={classNames(
          'group relative flex h-[30px] items-center rounded border-l-2 hover:bg-accent-primary-alpha',
          selectedPublication?.url === publication.url &&
            !selectedConversationIds.length
            ? 'border-l-accent-primary bg-accent-primary-alpha'
            : 'border-l-transparent',
        )}
      >
        <div className="group/button flex size-full cursor-pointer items-center gap-1 py-2 pr-3">
          <CaretIconComponent isOpen={isOpen} />
          <PublicationIcon className="text-secondary" width={18} height={18} />
          <div
            className={classNames(
              'relative max-h-5 flex-1 truncate break-all text-left',
              some(publication.resources, (r) =>
                some(selectedConversationIds, (id) =>
                  id.startsWith(r.reviewUrl),
                ),
              ) && 'text-accent-secondary',
            )}
            data-qa="folder-name"
          >
            {publication.url.split('/').slice(-1).shift()}
          </div>
        </div>
      </div>
      {isOpen && publication.resources && (
        <PublicationResources resources={publication.resources} />
      )}
    </>
  );
};

export const ApproveRequiredSection = ({
  name,
  resourceType,
  displayRootFiles,
  openByDefault = false,
  dataQa,
}: Omit<FolderSectionProps, 'filters'> & {
  resourceType: BackendResourceType;
}) => {
  const { t } = useTranslation(Translation.SideBar);

  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const publicationItems = useAppSelector((state) =>
    PublicationSelectors.selectFilteredPublications(state, resourceType),
  );

  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);

  useEffect(() => {
    const publicationReviewIds = publicationItems.flatMap((p) =>
      p.resources?.map((r) => r.reviewUrl),
    );
    const shouldBeHighlighted = !!(
      (selectedPublication && !selectedConversationsIds.length) ||
      selectedConversationsIds.some((id) => publicationReviewIds.includes(id))
    );

    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    isSectionHighlighted,
    publicationItems,
    selectedConversations,
    selectedConversationsIds,
    selectedPublication,
  ]);

  return (
    <CollapsibleSection
      name={t(name)}
      openByDefault={openByDefault}
      dataQa={dataQa}
      isHighlighted={isSectionHighlighted}
    >
      {publicationItems.map((p) => (
        <PublicationItem
          status={PublicationStatus.PENDING}
          key={p.url}
          publication={p}
        />
      ))}
    </CollapsibleSection>
  );
};
