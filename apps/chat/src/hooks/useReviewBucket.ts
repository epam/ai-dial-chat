import { useMemo } from 'react';

import { useRouter } from 'next/router';

import { getEntityBucket } from '@/src/utils/app/id';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import uniq from 'lodash-es/uniq';

export const useReviewBucket = () => {
  const router = useRouter();

  const { publicationUrl: queryPublicationUrl } = router.query;
  const storePublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );

  const publicationUrl = queryPublicationUrl?.toString() || storePublicationUrl;

  const publication = useAppSelector((state) =>
    publicationUrl
      ? PublicationSelectors.selectPublicationByUrl(state, publicationUrl)
      : undefined,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const areAllReviewConversations = useMemo(
    () =>
      selectedConversations.length &&
      selectedConversations.every((c) => !!c.publicationInfo?.publicationUrl),
    [selectedConversations],
  );
  const buckets = useMemo(
    () => selectedConversations.map(getEntityBucket),
    [selectedConversations],
  );
  const areBucketsSame = useMemo(() => uniq(buckets).length === 1, [buckets]);
  const areAllSamePublicationConversations =
    areAllReviewConversations && areBucketsSame;
  const publicationResources = publication?.resources ?? [];
  const firstReviewUrl = publicationResources[0]?.reviewUrl;

  if (!publicationResources?.length && !areAllSamePublicationConversations) {
    return undefined;
  }

  return firstReviewUrl ? getEntityBucket({ id: firstReviewUrl }) : buckets[0];
};
