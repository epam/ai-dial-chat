import { Conversation } from '@/chat/types/chat';
import { BackendEntity } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import {
  BucketUtil,
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

    const publishedConversations =
      await adminPublicationApiHelper.listPublishedConversations();

    //list pending requests
    const publicationRequests =
      await adminPublicationApiHelper.listPublicationRequests();
    for (const publicationRequest of publicationRequests.publications) {
      //if the request is pending un-publication
      if (publicationRequest.name?.trim()?.startsWith(unpublishRequestPrefix)) {
        const publicationDetails =
          await adminPublicationApiHelper.getPublicationRequestDetails(
            publicationRequest.url,
          );

        //reject if the request has already been unpublished
        if (publishedConversations.items !== undefined) {
          if (
            publishedConversations.items.some(
              (item) => item.url === publicationDetails.resources[0].targetUrl,
            )
          ) {
            await adminPublicationApiHelper.approveRequest(publicationRequest);
          } else {
            await adminPublicationApiHelper.rejectRequest(publicationRequest);
          }
        }
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

dialTest(
  'Cleanup published E2E apps',
  async ({ adminPublicationApiHelper, publishRequestBuilder }) => {
    const publishedApps = await adminPublicationApiHelper.listPublishedApps();
    const publishedE2EApps = publishedApps.items?.filter((a) =>
      a.name.includes(applicationNamePrefix),
    );

    for (const app of publishedE2EApps!) {
      const pathParts = app.url.split('/');
      let relativePath = '';
      const publicSegmentIndex = pathParts.indexOf('public');

      if (
        publicSegmentIndex !== -1 &&
        publicSegmentIndex < pathParts.length - 2
      ) {
        relativePath =
          pathParts.slice(publicSegmentIndex + 1, -1).join('/') + '/';
      } else if (
        publicSegmentIndex !== -1 &&
        publicSegmentIndex === pathParts.length - 2
      ) {
        relativePath = '';
      }

      const unpublishRequest = publishRequestBuilder
        .withName(unpublishRequestPrefix + app.name)
        .withTargetFolder(relativePath)
        .withApplicationResource(
          {
            url: app.url,
            name: app.name,
            bucket: app.bucket,
          } as BackendEntity,
          PublishActions.DELETE,
        )
        .build();

      const unpublishResponse =
        await adminPublicationApiHelper.createUnpublishRequest(
          unpublishRequest,
        );
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);

dialTest(
  'Cleanup published E2E conversations',
  async ({ adminPublicationApiHelper, publishRequestBuilder }) => {
    const publishedConversations =
      await adminPublicationApiHelper.listPublishedConversations();
    const publishedE2EConversations = publishedConversations.items?.filter(
      (a) => a.name.includes(conversationNamePrefix),
    );

    for (const conversation of publishedE2EConversations!) {
      const pathParts = conversation.url.split('/');
      let relativePath = '';
      const publicSegmentIndex = pathParts.indexOf('public');

      if (
        publicSegmentIndex !== -1 &&
        publicSegmentIndex < pathParts.length - 2
      ) {
        relativePath =
          pathParts.slice(publicSegmentIndex + 1, -1).join('/') + '/';
      } else if (
        publicSegmentIndex !== -1 &&
        publicSegmentIndex === pathParts.length - 2
      ) {
        relativePath = '';
      }

      const unpublishRequest = publishRequestBuilder
        .withName(unpublishRequestPrefix + conversation.name)
        .withTargetFolder(relativePath)
        .withConversationResource(
          {
            id: conversation.url.substring(
              0,
              conversation.url.lastIndexOf('__'),
            ),
          } as Conversation,
          PublishActions.DELETE,
        )
        .build();

      const unpublishResponse =
        await adminPublicationApiHelper.createUnpublishRequest(
          unpublishRequest,
        );
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);
