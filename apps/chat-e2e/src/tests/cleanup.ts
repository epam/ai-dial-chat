import dialTest from '@/src/core/dialFixtures';
import { BucketUtil } from '@/src/utils';

// eslint-disable-next-line playwright/expect-expect
dialTest(
  'Cleanup shared entities',
  async ({
    additionalUserItemApiHelper,
    additionalUserShareApiHelper,
    additionalSecondUserShareApiHelper,
    additionalSecondUserItemApiHelper,
  }) => {
    await additionalUserItemApiHelper.deleteAllData(
      false,
      BucketUtil.getAdditionalShareUserBucket(),
    );
    await additionalSecondUserItemApiHelper.deleteAllData(
      false,
      BucketUtil.getAdditionalSecondShareUserBucket(),
    );

    const additionalUserSharedConversations =
      await additionalUserShareApiHelper.listSharedWithMeConversations();
    await additionalUserShareApiHelper.deleteSharedWithMeEntities(
      additionalUserSharedConversations.resources,
    );

    const additionalSecondUserSharedConversations =
      await additionalSecondUserShareApiHelper.listSharedWithMeConversations();
    await additionalSecondUserShareApiHelper.deleteSharedWithMeEntities(
      additionalSecondUserSharedConversations.resources,
    );
  },
);
