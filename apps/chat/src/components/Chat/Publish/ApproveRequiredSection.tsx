import { IconClipboard } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import { isFileId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { getPublicationId } from '@/src/utils/app/publications';

import { FeatureType } from '@/src/types/common';
import { FolderSectionProps } from '@/src/types/folder';
import { Publication, PublicationInfo } from '@/src/types/publication';

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
import { ReviewDot } from './ReviewDot';

import { UploadStatus } from '@epam/ai-dial-shared';

interface PublicationProps {
  publication: PublicationInfo & Partial<Publication>;
  featureTypes: FeatureType[];
}

const featureTypesWithCaretIcon = [FeatureType.Chat, FeatureType.Prompt];

const PublicationItem = ({ publication, featureTypes }: PublicationProps) => {
  const dispatch = useAppDispatch();

  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );
  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const itemsToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourcesToReviewByPublicationUrl(
      state,
      publication.url,
    ),
  );

  const [isOpen, setIsOpen] = useState(
    selectedPublicationUrl === publication.url,
  );

  const handlePublicationSelect = useCallback(() => {
    setIsOpen((value) => !value);

    if (publication.uploadStatus !== UploadStatus.LOADED) {
      dispatch(PublicationActions.uploadPublication({ url: publication.url }));
    } else {
      dispatch(PublicationActions.selectPublication(publication.url));
    }

    dispatch(
      ConversationsActions.selectConversations({
        conversationIds: [],
      }),
    );
  }, [dispatch, publication]);

  const showCaretIcon = featureTypesWithCaretIcon.some((type) =>
    publication.resourceTypes.includes(
      EnumMapper.getBackendResourceTypeByFeatureType(type),
    ),
  );

  const additionalItemData = useMemo(
    () => ({ publicationUrl: publication.url, isSidePanelItem: true }),
    [publication.url],
  );

  const ResourcesComponent = featureTypes.includes(FeatureType.Chat)
    ? ConversationPublicationResources
    : featureTypes.includes(FeatureType.Prompt)
      ? PromptPublicationResources
      : null;

  return (
    <div className="flex flex-col gap-1">
      <div
        onClick={handlePublicationSelect}
        className={classNames(
          'group relative flex h-[34px] items-center rounded border-l-2 hover:bg-accent-primary-alpha',
          selectedPublicationUrl === publication.url &&
            !selectedConversationIds.length
            ? 'border-l-accent-primary bg-accent-primary-alpha'
            : 'border-l-transparent',
        )}
        data-qa="folder"
      >
        <div className="group/button flex size-full cursor-pointer items-center gap-1 py-2 pr-3">
          <CaretIconComponent hidden={!showCaretIcon} isOpen={isOpen} />
          <div className="relative">
            <IconClipboard
              className="text-secondary"
              strokeWidth={1.5}
              width={24}
              height={24}
            />
            {(!itemsToReview
              .filter((item) => !isFileId(item.reviewUrl))
              .every((item) => item.reviewed) ||
              publication.uploadStatus !== UploadStatus.LOADED) && (
              <ReviewDot
                className={classNames(
                  'group-hover:bg-accent-primary-alpha',
                  selectedPublicationUrl === publication.url &&
                    !selectedConversationIds.length &&
                    'bg-accent-primary-alpha',
                )}
              />
            )}
          </div>
          <div
            className={classNames(
              'relative max-h-5 flex-1 truncate break-all text-left',
              selectedPublicationUrl === publication.url &&
                'text-accent-primary',
            )}
            data-qa="folder-name"
          >
            {publication.name || getPublicationId(publication.url)}
          </div>
        </div>
      </div>
      {publication.resources && ResourcesComponent && (
        <ResourcesComponent
          resources={publication.resources}
          isOpen={isOpen}
          additionalItemData={additionalItemData}
        />
      )}
    </div>
  );
};

export const ApproveRequiredSection = ({
  name,
  featureTypes,
  displayRootFiles,
  openByDefault,
  dataQa,
  publicationItems,
  includeEmptyResourceTypesEmpty,
}: Omit<FolderSectionProps, 'filters'> & {
  featureTypes: FeatureType[];
  publicationItems: (PublicationInfo & Partial<Publication>)[];
  includeEmptyResourceTypesEmpty?: boolean;
}) => {
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const publicationsToReviewCount = useAppSelector((state) =>
    PublicationSelectors.selectPublicationsToReviewCount(
      state,
      featureTypes,
      includeEmptyResourceTypesEmpty,
    ),
  );

  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);

  const { handleToggle, isExpanded } = useSectionToggle(
    name,
    featureTypes.includes(FeatureType.Chat)
      ? FeatureType.Chat
      : FeatureType.Prompt,
  );

  useEffect(() => {
    const publicationReviewIds = publicationItems.flatMap((p) =>
      p.resources?.map((res) => res.reviewUrl),
    );
    const shouldBeHighlighted = !!(
      (selectedPublication &&
        !selectedConversationsIds.length &&
        (selectedPublication.resourceTypes.some((resourceType) =>
          featureTypes
            .map((featureType) =>
              EnumMapper.getBackendResourceTypeByFeatureType(featureType),
            )
            .includes(resourceType),
        ) ||
          (!selectedPublication.resourceTypes.length &&
            includeEmptyResourceTypesEmpty))) ||
      selectedConversationsIds.some((id) => publicationReviewIds.includes(id))
    );

    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    isSectionHighlighted,
    publicationItems,
    featureTypes,
    selectedConversations,
    selectedConversationsIds,
    selectedPublication,
    includeEmptyResourceTypesEmpty,
  ]);

  return (
    <CollapsibleSection
      onToggle={handleToggle}
      name={name}
      openByDefault={openByDefault ?? isExpanded}
      dataQa={dataQa}
      isHighlighted={isSectionHighlighted}
      additionalNode={
        !!publicationsToReviewCount && (
          <span className="absolute right-4 flex h-[14px] min-w-[14px] select-none items-center justify-center rounded bg-accent-primary px-[2px] text-[10px] font-semibold text-controls-disable">
            {publicationsToReviewCount}
          </span>
        )
      }
      className="relative gap-0.5"
    >
      {publicationItems.map((p) => (
        <PublicationItem
          featureTypes={featureTypes}
          key={p.url}
          publication={p}
        />
      ))}
    </CollapsibleSection>
  );
};
