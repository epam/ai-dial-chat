import { IconClipboard } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import { isFileId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { getPublicationId } from '@/src/utils/app/publications';

import { FeatureType, UploadStatus } from '@/src/types/common';
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

import some from 'lodash-es/some';

interface PublicationProps {
  publication: PublicationInfo & Partial<Publication>;
  featureTypes: FeatureType[];
}

const PublicationItem = ({ publication, featureTypes }: PublicationProps) => {
  const dispatch = useAppDispatch();

  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
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
    selectedPublication?.url === publication.url,
  );

  const selectedItemIsPublication = useMemo(
    () =>
      some(publication.resources, (r) =>
        some(selectedConversationIds, (id) => id.startsWith(r.reviewUrl)),
      ),
    [publication.resources, selectedConversationIds],
  );

  const handlePublicationSelect = useCallback(() => {
    setIsOpen((value) => !value);

    if (publication.uploadStatus !== UploadStatus.LOADED) {
      dispatch(PublicationActions.uploadPublication({ url: publication.url }));
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
  }, [dispatch, publication]);

  const ResourcesComponent = featureTypes.includes(FeatureType.Chat)
    ? ConversationPublicationResources
    : PromptPublicationResources;
  const isLeftSidePublication =
    featureTypes.includes(FeatureType.Chat) ||
    featureTypes.includes(FeatureType.File);

  return (
    <div className="flex flex-col gap-1">
      <div
        onClick={handlePublicationSelect}
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
          <div className="relative">
            <IconClipboard className="text-secondary" width={18} height={18} />
            {(!itemsToReview
              .filter((item) => !isFileId(item.reviewUrl))
              .every((item) => item.reviewed) ||
              publication.uploadStatus !== UploadStatus.LOADED) && (
              <ReviewDot
                className={classNames(
                  isLeftSidePublication
                    ? 'group-hover:bg-accent-secondary-alpha'
                    : 'group-hover:bg-accent-tertiary-alpha',
                  selectedPublication?.url === publication.url &&
                    !selectedConversationIds.length &&
                    (isLeftSidePublication
                      ? 'bg-accent-secondary-alpha'
                      : 'bg-accent-tertiary-alpha'),
                )}
              />
            )}
          </div>
          <div
            className={classNames(
              'relative max-h-5 flex-1 truncate break-all text-left',
              selectedItemIsPublication && 'text-accent-primary',
            )}
            data-qa="folder-name"
          >
            {publication.name || getPublicationId(publication.url)}
          </div>
        </div>
      </div>
      {publication.resources && (
        <ResourcesComponent
          resources={publication.resources}
          isOpen={isOpen}
          additionalItemData={{ isApproveRequiredResource: true }}
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
      p.resources?.map((r) => r.reviewUrl),
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
        <span className="absolute right-4 flex h-[14px] select-none items-center justify-center rounded bg-accent-secondary px-[2px] text-[10px] font-semibold text-controls-disable">
          {publicationsToReviewCount}
        </span>
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
