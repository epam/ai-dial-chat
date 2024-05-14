import { IconClipboard, IconClipboardX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { BackendResourceType } from '@/src/types/common';
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

import CaretIconComponent from '../../Common/CaretIconComponent';
import CollapsibleSection from '../../Common/CollapsibleSection';
import {
  ConversationPublicationResources,
  PromptPublicationResources,
} from './PublicationResources';

import { some } from 'lodash-es';

interface PublicationProps {
  publication: PublicationInfo & Partial<Publication>;
  resourceType: BackendResourceType;
}

const PublicationItem = ({ publication, resourceType }: PublicationProps) => {
  const dispatch = useAppDispatch();

  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  const [isOpen, setIsOpen] = useState(false);

  const PublicationIcon =
    publication.status !== PublicationStatus.REQUESTED_FOR_DELETION
      ? IconClipboard
      : IconClipboardX;
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
                  id.startsWith(r.reviewUrl ? r.reviewUrl : r.targetUrl),
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
      (selectedPublication &&
        !selectedConversationsIds.length &&
        selectedPublication.resourceTypes.includes(resourceType)) ||
      selectedConversationsIds.some((id) => publicationReviewIds.includes(id))
    );

    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    isSectionHighlighted,
    publicationItems,
    resourceType,
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
          key={p.url}
          publication={p}
        />
      ))}
    </CollapsibleSection>
  );
};
