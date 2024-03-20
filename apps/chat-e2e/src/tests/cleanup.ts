import dialTest from '@/src/core/dialFixtures';
import { BucketUtil } from '@/src/utils';

dialTest(
  'Cleanup shared entities',
  async ({ additionalUserItemApiHelper, additionalUserShareApiHelper }) => {
    await additionalUserItemApiHelper.deleteAllData(
      BucketUtil.getAdditionalShareUserBucket(),
    );

    const sharedEntities =
      await additionalUserShareApiHelper.listSharedWithMeEntities();
    await additionalUserShareApiHelper.deleteSharedWithMeEntities(
      sharedEntities.resources,
    );
  },
);
