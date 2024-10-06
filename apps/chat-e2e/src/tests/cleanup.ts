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
    additionalShareUserFileApiHelper,
    additionalSecondShareUserFileApiHelper,
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
    ]);
    for (const file of additionalUserSharedFiles.resources) {
      await additionalShareUserFileApiHelper.deleteFromSharedWithMe(file.url);
    }

    const additionalSecondUserSharedConversations =
      await additionalSecondUserShareApiHelper.listSharedWithMeConversations();
    const additionalSecondUserSharedPrompts =
      await additionalSecondUserShareApiHelper.listSharedWithMePrompts();
    const additionalSecondUserSharedFiles =
      await additionalSecondUserShareApiHelper.listSharedWithMeFiles();
    await additionalSecondUserShareApiHelper.deleteSharedWithMeEntities([
      ...additionalSecondUserSharedConversations.resources,
      ...additionalSecondUserSharedPrompts.resources,
    ]);
    for (const file of additionalSecondUserSharedFiles.resources) {
      await additionalSecondShareUserFileApiHelper.deleteFromSharedWithMe(
        file.url,
      );
    }
  },
);
