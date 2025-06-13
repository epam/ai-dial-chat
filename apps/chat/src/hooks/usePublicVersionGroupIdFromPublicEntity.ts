import { constructPath } from '@/src/utils/app/file';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { getPublicItemIdWithoutVersion } from '@/src/utils/server/api';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import { NA_VERSION, PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';

export const usePublicVersionGroupId = (entity: ShareEntity) => {
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(state, entity.id),
  );

  if (isEntityIdPublic(entity)) {
    return getPublicItemIdWithoutVersion(
      entity.publicationInfo?.version ?? NA_VERSION,
      entity.id,
    );
  }

  if (resourceToReview) {
    return getPublicItemIdWithoutVersion(
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
    );
  }

  return undefined;
};
