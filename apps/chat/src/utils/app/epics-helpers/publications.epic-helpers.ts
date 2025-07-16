import { EMPTY, of } from 'rxjs';

import { PublicationResource } from '@/src/types/publication';
import { RootState } from '@/src/types/store';

import { PublicationActions } from '@/src/store/actions';
import { PublicationSelectors } from '@/src/store/selectors';

export const getSetUpdatedItemsToApproveAction = (
  state: RootState,
  oldPublicationResources: PublicationResource[],
  newPublicationResources: PublicationResource[],
  publicationUrl: string,
) => {
  const selectedItemsToApprove =
    PublicationSelectors.selectSelectedItemsToApprove(state);

  const previousSourceUrlsToApprove = oldPublicationResources
    .filter((resource) => selectedItemsToApprove.includes(resource.reviewUrl))
    .map((resource) => resource.sourceUrl ?? '');
  const newSelectedItemsToApprove = newPublicationResources.filter(
    (resource) =>
      resource.sourceUrl &&
      previousSourceUrlsToApprove.includes(resource.sourceUrl),
  );

  if (newSelectedItemsToApprove.length) {
    return of(
      PublicationActions.setItemsToApprove({
        publicationUrl,
        ids: newSelectedItemsToApprove.map((resource) => resource.reviewUrl),
      }),
    );
  }

  return EMPTY;
};
