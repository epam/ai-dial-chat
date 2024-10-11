import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { BucketUtil } from '@/src/utils';

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
