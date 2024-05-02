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
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { PromptComponent } from '../../Promptbar/components/Prompt';

import { ConversationComponent } from '../../Chatbar/Conversation';
import CaretIconComponent from '../../Common/CaretIconComponent';
import CollapsibleSection from '../../Common/CollapsibleSection';
import Folder from '../../Folder/Folder';

import { some, uniqBy } from 'lodash-es';

const PromptPublicationResources = ({
  resources,
}: {
  resources: PublicationResource[];
}) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Prompt),
  );
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const publicationFolders = useAppSelector(
    PromptsSelectors.selectPublicationFolders,
  );
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const highlightedFolders = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );

  const resourceUrls = useMemo(
    () => resources.map((r) => r.reviewUrl),
    [resources],
  );
  const promptsToDisplay = useMemo(() => {
    return prompts.filter(
      (c) => c.folderId.split('/').length === 2 && resourceUrls.includes(c.id),
    );
  }, [prompts, resourceUrls]);
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
            allItems={prompts}
            itemComponent={PromptComponent}
            onClickFolder={(folderId: string) => {
              dispatch(PromptsActions.toggleFolder({ id: folderId }));
            }}
            featureType={FeatureType.Prompt}
            highlightedFolders={highlightedFolders}
          />
        );
      })}
      {promptsToDisplay.map((p) => (
        <PromptComponent key={p.id} item={p} level={1} />
      ))}
    </>
  );
};

const ConversationPublicationResources = ({
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
  resourceType,
}: {
  publication: PublicationInfo & Partial<Publication>;
  status: PublicationStatus;
  resourceType: BackendResourceType;
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
  const ResourcesComponent =
    resourceType === BackendResourceType.CONVERSATION
      ? ConversationPublicationResources
      : PromptPublicationResources;

  return (
    <div className="flex flex-col gap-1">
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
              ) && 'text-accent-primary',
            )}
            data-qa="folder-name"
          >
            {publication.url.split('/').slice(-1).shift()}
          </div>
        </div>
      </div>
      {isOpen && publication.resources && (
        <ResourcesComponent resources={publication.resources} />
      )}
    </div>
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
          resourceType={resourceType}
          status={PublicationStatus.PENDING}
          key={p.url}
          publication={p}
        />
      ))}
    </CollapsibleSection>
  );
};
