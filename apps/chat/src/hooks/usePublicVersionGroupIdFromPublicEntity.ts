import { constructPath } from '@/src/utils/app/file';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { getPublicItemIdWithoutVersion } from '@/src/utils/server/api';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { NA_VERSION, PUBLIC_URL_PREFIX } from '../constants/public';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';

export const usePublicVersionGroupId = (entity: ShareEntity) => {
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(state, entity.id),
  );

  return {
    publicVersionGroupId: isEntityIdPublic(entity)
      ? getPublicItemIdWithoutVersion(
          entity.publicationInfo?.version ?? NA_VERSION,
          entity.id,
        )
      : resourceToReview
        ? getPublicItemIdWithoutVersion(
            entity.publicationInfo?.version ?? NA_VERSION,
            constructPath(
              entity.id.split('/')[0],
              PUBLIC_URL_PREFIX,
              ...(selectedPublication &&
              entity.publicationInfo?.action !== PublishActions.DELETE
                ? selectedPublication.targetFolder.split('/').slice(1)
                : ''),
              ...entity.id.split('/').slice(2),
            ),
          )
        : undefined,
    isReviewEntity:
      resourceToReview &&
      selectedPublication?.resources.some(
        (resource) => resource.reviewUrl === resourceToReview.reviewUrl,
      ),
  };
};
