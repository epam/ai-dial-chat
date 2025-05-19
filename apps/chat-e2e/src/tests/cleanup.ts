import { BackendEntity, BackendResourceType } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import { Attachment } from '@/src/testData';
import {
  BucketUtil,
  ItemUtil,
  applicationNamePrefix,
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
      //if the request is pending un-publication
      if (publicationRequest.name?.trim()?.startsWith(unpublishRequestPrefix)) {
        const publicationDetails =
          await adminPublicationApiHelper.getPublicationRequestDetails(
            publicationRequest.url,
          );
        //reject if the request has already been unpublished
        if (
          publicationDetails.resources.every(
            (resource) => resource.sourceUrl === null,
          )
        ) {
          await adminPublicationApiHelper.rejectRequest(publicationRequest);
        } else {
          await adminPublicationApiHelper.approveRequest(publicationRequest);
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
    const publishedApps =
      await adminPublicationApiHelper.listPublishedResources(
        BackendResourceType.APPLICATION,
      );
    const publishedE2EApps = publishedApps.items?.filter((a) =>
      a.name.includes(applicationNamePrefix),
    );

    for (const app of publishedE2EApps!) {
      const unpublishRequest = publishRequestBuilder
        .withName(unpublishRequestPrefix + app.name)
        .withTargetFolder(ItemUtil.getPublishedItemRelativePath(app))
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
  'Cleanup published E2E files',
  async ({ adminPublicationApiHelper, publishRequestBuilder }) => {
    const publishedFiles =
      await adminPublicationApiHelper.listPublishedResources(
        BackendResourceType.FILE,
      );
    const publishedE2EFiles = publishedFiles.items?.filter((item) =>
      Object.values(Attachment).includes(item.name),
    );

    for (const file of publishedE2EFiles!) {
      const unpublishRequest = publishRequestBuilder
        .withName(unpublishRequestPrefix + file.name)
        .withTargetFolder(ItemUtil.getPublishedItemRelativePath(file))
        .withFileResource(file.url, PublishActions.DELETE)
        .build();

      const unpublishResponse =
        await adminPublicationApiHelper.createUnpublishRequest(
          unpublishRequest,
        );
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);
