import { Conversation } from '@/chat/types/chat';
import { BackendEntity } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import {
  BucketUtil,
  ItemUtil,
  applicationNamePrefix,
  conversationNamePrefix,
  publicationRequestPrefix,
  unpublishRequestPrefix,
} from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

dialTest(
  'Cleanup admin data',
  async ({ adminUserItemApiHelper, adminPublicationApiHelper }) => {
    await adminUserItemApiHelper.deleteAllData(BucketUtil.getAdminUserBucket());

    //list pending requests
    const publicationRequests =
      await adminPublicationApiHelper.listPublicationRequests();
    for (const publicationRequest of publicationRequests.publications) {
      if (
        publicationRequest.name?.startsWith(unpublishRequestPrefix) ||
        publicationRequest.name?.startsWith(publicationRequestPrefix)
      ) {
        await adminPublicationApiHelper.rejectRequest(publicationRequest);
      }
    }
  },
);

dialTest(
  'Cleanup published E2E entities (apps and conversations)',
  async ({ adminPublicationApiHelper, publishRequestBuilder }) => {
    // Cleanup published E2E apps
    const publishedApps = await adminPublicationApiHelper.listPublishedApps();
    const publishedE2EApps = publishedApps.items?.filter((app) =>
      app.name.includes(applicationNamePrefix),
    );

    for (const app of publishedE2EApps || []) {
      const relativePath = ItemUtil.extractRelativePath(app.url);

      await adminPublicationApiHelper.unpublishEntity(
        app.name,
        relativePath,
        publishRequestBuilder,
        (request) => {
          return request.withApplicationResource(
            {
              url: app.url,
              name: app.name,
              bucket: app.bucket,
            } as BackendEntity,
            PublishActions.DELETE,
          );
        },
      );
    }

    // Cleanup published E2E conversations
    const publishedConversations =
      await adminPublicationApiHelper.listPublishedConversations();
    const publishedE2EConversations = publishedConversations.items?.filter(
      (conversation) => conversation.name.includes(conversationNamePrefix),
    );

    for (const conversation of publishedE2EConversations || []) {
      const relativePath = ItemUtil.extractRelativePath(conversation.url);

      await adminPublicationApiHelper.unpublishEntity(
        conversation.name,
        relativePath,
        publishRequestBuilder,
        (request) => {
          return request.withConversationWithoutFolderResource(
            {
              id: conversation.url.substring(
                0,
                conversation.url.lastIndexOf('__'),
              ),
            } as Conversation,
            PublishActions.DELETE,
          );
        },
      );
    }
  },
);
