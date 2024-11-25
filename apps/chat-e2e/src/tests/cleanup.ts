import dialTest from '@/src/core/dialFixtures';
import {
  BucketUtil,
  publicationRequestPrefix,
  unpublishRequestPrefix,
} from '@/src/utils';

dialTest(
  'Cleanup admin data',
  async ({ adminUserItemApiHelper, adminPublicationApiHelper }) => {
    await adminUserItemApiHelper.deleteAllData(BucketUtil.getAdminUserBucket());

    //list pending requests
    const publicationRequests =
      await adminPublicationApiHelper.listPublicationRequests();
    for (const publicationRequest of publicationRequests.publications) {
      //if the request is pending un-publication
      if (publicationRequest.name?.trim()?.startsWith(unpublishRequestPrefix)) {
        await adminPublicationApiHelper.approveRequest(publicationRequest);
      }
      //if the request is pending publication
      else if (
        publicationRequest.name?.trim().startsWith(publicationRequestPrefix)
      ) {
        await adminPublicationApiHelper.rejectRequest(publicationRequest);
      }
    }
  },
);
