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
      BucketUtil.getAdditionalShareUserBucket(),
    );
    await additionalSecondUserItemApiHelper.deleteAllData(
      BucketUtil.getAdditionalSecondShareUserBucket(),
    );

    const additionalUserSharedEntities =
      await additionalUserShareApiHelper.listSharedWithMeEntities();
    await additionalUserShareApiHelper.deleteSharedWithMeEntities(
      additionalUserSharedEntities.resources,
    );

    const additionalSecondUserSharedEntities =
      await additionalSecondUserShareApiHelper.listSharedWithMeEntities();
    await additionalSecondUserShareApiHelper.deleteSharedWithMeEntities(
      additionalSecondUserSharedEntities.resources,
    );
  },
);
