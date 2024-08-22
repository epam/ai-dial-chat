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

    const additionalUserSharedConversations =
      await additionalUserShareApiHelper.listSharedWithMeConversations();
    const additionalUserSharedPrompts =
      await additionalUserShareApiHelper.listSharedWithMePrompts();
    await additionalUserShareApiHelper.deleteSharedWithMeEntities([
      ...additionalUserSharedConversations.resources,
      ...additionalUserSharedPrompts.resources,
    ]);

    const additionalSecondUserSharedConversations =
      await additionalSecondUserShareApiHelper.listSharedWithMeConversations();
    const additionalSecondUserSharedPrompts =
      await additionalSecondUserShareApiHelper.listSharedWithMePrompts();
    await additionalSecondUserShareApiHelper.deleteSharedWithMeEntities([
      ...additionalSecondUserSharedConversations.resources,
      ...additionalSecondUserSharedPrompts.resources,
    ]);
  },
);
