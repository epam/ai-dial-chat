import { Conversation } from '@/chat/types/chat';
import { BackendEntity, BackendResourceType } from '@/chat/types/common';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import { Attachment } from '@/src/testData';
import {
  BucketUtil,
  ItemUtil,
  applicationNamePrefix,
  conversationNamePrefix,
  promptNamePrefix,
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
    const e2ePublicationRequests = publicationRequests.publications.filter(
      (p) =>
        p.name?.trim().startsWith(unpublishRequestPrefix) ||
        p.name?.trim().startsWith(publicationRequestPrefix),
    );

    for (const publicationRequest of e2ePublicationRequests) {
      await adminPublicationApiHelper.rejectRequest(publicationRequest);
    }
  },
);

dialTest(
  'Cleanup published E2E entities (apps, conversations, files)',
  async ({ adminPublicationApiHelper, publishRequestBuilder }) => {
    // Cleanup published E2E apps
    const publishedApps =
      await adminPublicationApiHelper.listPublishedResources(
        BackendResourceType.APPLICATION,
      );
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
      await adminPublicationApiHelper.listPublishedResources(
        BackendResourceType.CONVERSATION,
      );
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
          const nameIndex = conversation.url.lastIndexOf(
            ItemUtil.entityIdSeparator,
          );
          return request.withConversationWithoutFolderResource(
            {
              id: conversation.url.substring(0, nameIndex),
            } as Conversation,
            PublishActions.DELETE,
            conversation.url.substring(
              nameIndex + ItemUtil.entityIdSeparator.length,
            ),
          );
        },
      );
    }

    //Cleanup published E2E prompts
    const publishedPrompts =
      await adminPublicationApiHelper.listPublishedResources(
        BackendResourceType.PROMPT,
      );
    const publishedE2EPrompts = publishedPrompts.items?.filter((prompt) =>
      prompt.name.includes(promptNamePrefix),
    );

    for (const prompt of publishedE2EPrompts || []) {
      const relativePath = ItemUtil.extractRelativePath(prompt.url);

      await adminPublicationApiHelper.unpublishEntity(
        prompt.name,
        relativePath,
        publishRequestBuilder,
        (request) => {
          const nameIndex = prompt.url.lastIndexOf(ItemUtil.entityIdSeparator);
          return request.withPromptWithoutFolderResource(
            {
              id: prompt.url.substring(0, nameIndex),
            } as Prompt,
            PublishActions.DELETE,
            prompt.url.substring(nameIndex + ItemUtil.entityIdSeparator.length),
          );
        },
      );
    }

    // Cleanup published E2E files
    const publishedFiles =
      await adminPublicationApiHelper.listPublishedResources(
        BackendResourceType.FILE,
      );
    const publishedE2EFiles = publishedFiles.items?.filter((item) =>
      Object.values(Attachment).includes(item.name),
    );
    for (const file of publishedE2EFiles || []) {
      const relativePath = ItemUtil.extractRelativePath(file.url);
      await adminPublicationApiHelper.unpublishEntity(
        file.name,
        relativePath,
        publishRequestBuilder,
        (request) => {
          return request.withFileResource(file.url, PublishActions.DELETE);
        },
      );
    }
  },
);
