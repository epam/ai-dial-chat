import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  BucketUtil,
  publicationRequestPrefix,
  unpublishRequestPrefix,
} from '@/src/utils';

// eslint-disable-next-line playwright/expect-expect
dialSharedWithMeTest(
  'Cleanup shared entities',
  async ({
    additionalUserItemApiHelper,
    additionalUserShareApiHelper,
    additionalSecondUserShareApiHelper,
    additionalSecondUserItemApiHelper,
  }) => {
    await additionalUserItemApiHelper.deleteAllData(
      BucketUtil.getAdditionalShareUserBucket(),
    );
    await additionalSecondUserItemApiHelper.deleteAllData(
      BucketUtil.getAdditionalSecondShareUserBucket(),
    );

    const additionalUserSharedConversations =
      await additionalUserShareApiHelper.listSharedWithMeConversations();
    const additionalUserSharedPrompts =
      await additionalUserShareApiHelper.listSharedWithMePrompts();
    const additionalUserSharedFiles =
      await additionalUserShareApiHelper.listSharedWithMeFiles();
    await additionalUserShareApiHelper.deleteSharedWithMeEntities([
      ...additionalUserSharedConversations.resources,
      ...additionalUserSharedPrompts.resources,
      ...additionalUserSharedFiles.resources,
    ]);

    const additionalSecondUserSharedConversations =
      await additionalSecondUserShareApiHelper.listSharedWithMeConversations();
    const additionalSecondUserSharedPrompts =
      await additionalSecondUserShareApiHelper.listSharedWithMePrompts();
    const additionalSecondUserSharedFiles =
      await additionalSecondUserShareApiHelper.listSharedWithMeFiles();
    await additionalSecondUserShareApiHelper.deleteSharedWithMeEntities([
      ...additionalSecondUserSharedConversations.resources,
      ...additionalSecondUserSharedPrompts.resources,
      ...additionalSecondUserSharedFiles.resources,
    ]);
  },
);

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
