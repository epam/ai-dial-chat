import { FC, useMemo } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { getEntityBucket, isRootEntity } from '@/src/utils/app/id';

import { AdditionalItemData, FeatureType } from '@/src/types/common';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  FilesSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { Folder } from '@/src/components/Folder/Folder';

import { FileItem } from './FileItem';
import { FilesSectionWrapper } from './FilesSectionWrapper';

interface ReviewBucketFilesSectionViewProps {
  bucket: string;
  searchQuery: string;
  highlightFolderIds: string[];
  openedFoldersIds: string[];
  additionalItemData: AdditionalItemData;
  canAttachFolders: boolean;
  onItemEvent: (eventId: string, data: unknown) => void;
  onClickFolder: (folderId: string) => void;
  onToggleFolder: (folderId: string) => void;
}

const ReviewBucketFilesSectionView: FC<ReviewBucketFilesSectionViewProps> = ({
  bucket,
  searchQuery,
  highlightFolderIds,
  openedFoldersIds,
  additionalItemData,
  canAttachFolders,
  onItemEvent,
  onClickFolder,
  onToggleFolder,
}) => {
  const { t } = useTranslation(Translation.Files);

  const reviewBucketFolders = useAppSelector((state) =>
    FilesSelectors.selectReviewBucketFolders(state, searchQuery, bucket),
  );
  const reviewBucketFiles = useAppSelector((state) =>
    FilesSelectors.selectReviewBucketFiles(state, bucket),
  );

  const rootReviewBucketFolders = useMemo(
    () => reviewBucketFolders.filter(({ id }) => isRootEntity(id)),
    [reviewBucketFolders],
  );

  const rootReviewBucketFiles = useMemo(
    () => reviewBucketFiles.filter(({ id }) => isRootEntity(id)),
    [reviewBucketFiles],
  );

  return (
    <FilesSectionWrapper
      name={t('Review files')}
      dataQa="review-files"
      folders={reviewBucketFolders}
      files={reviewBucketFiles}
      sourceType={FileSourceType.REVIEW_FILES}
    >
      <div className="flex flex-col gap-1 overflow-auto">
        {rootReviewBucketFolders.map((folder) => {
          return (
            <Folder
              key={folder.id}
              searchTerm={searchQuery}
              currentFolder={folder}
              allFolders={reviewBucketFolders}
              highlightedFolders={highlightFolderIds}
              openedFoldersIds={openedFoldersIds}
              allItems={reviewBucketFiles}
              additionalItemData={additionalItemData}
              itemComponent={FileItem}
              onClickFolder={onClickFolder}
              onItemEvent={onItemEvent}
              withBorderHighlight={false}
              featureType={FeatureType.File}
              canSelectFolders={canAttachFolders}
              showTooltip
              onSelectFolder={onToggleFolder}
            />
          );
        })}
        {rootReviewBucketFiles.map((file) => {
          return (
            <FileItem
              key={file.id}
              item={file}
              level={0}
              additionalItemData={additionalItemData}
              onEvent={onItemEvent}
            />
          );
        })}
      </div>
    </FilesSectionWrapper>
  );
};

interface Props {
  searchQuery: string;
  highlightFolderIds: string[];
  additionalItemData: AdditionalItemData;
  openedFoldersIds: string[];
  canAttachFolders: boolean;
  onItemEvent: (eventId: string, data: unknown) => void;
  onClickFolder: (folderId: string) => void;
  onToggleFolder: (folderId: string) => void;
}

export const ReviewBucketFilesSection: FC<Props> = ({
  searchQuery,
  highlightFolderIds,
  additionalItemData,
  openedFoldersIds,
  canAttachFolders,
  onItemEvent,
  onClickFolder,
  onToggleFolder,
}) => {
  const router = useRouter();
  const { publicationUrl } = router.query;

  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const publication = useAppSelector((state) =>
    PublicationSelectors.selectPublicationByUrl(
      state,
      publicationUrl as string,
    ),
  );

  const areAllReviewConversations = useMemo(
    () =>
      selectedConversations.length > 0 &&
      selectedConversations.every(
        (conversation) => !!conversation.publicationInfo?.publicationUrl,
      ),
    [selectedConversations],
  );

  const buckets = useMemo(
    () => selectedConversations.map(getEntityBucket),
    [selectedConversations],
  );

  const areBucketsSame = useMemo(() => {
    if (buckets.length < 2) return true;
    return buckets.every((bucket) => bucket === buckets[0]);
  }, [buckets]);

  const isAllConversationsFromSamePublication =
    areAllReviewConversations && areBucketsSame;
  const publicationResources = publication?.resources ?? [];

  if (!publicationResources.length && !isAllConversationsFromSamePublication) {
    return null;
  }

  const reviewBucket =
    getEntityBucket({ id: publicationResources[0].reviewUrl }) ?? buckets[0];

  return (
    <ReviewBucketFilesSectionView
      bucket={reviewBucket}
      searchQuery={searchQuery}
      highlightFolderIds={highlightFolderIds}
      openedFoldersIds={openedFoldersIds}
      additionalItemData={additionalItemData}
      canAttachFolders={canAttachFolders}
      onItemEvent={onItemEvent}
      onClickFolder={onClickFolder}
      onToggleFolder={onToggleFolder}
    />
  );
};
