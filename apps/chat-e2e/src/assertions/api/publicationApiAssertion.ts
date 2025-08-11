import { BackendResourceType } from '@/chat/types/common';
import { BaseAssertion } from '@/src/assertions';
import { PublishingExpectedMessages } from '@/src/testData';
import { PublicationApiHelper } from '@/src/testData/api';

export class PublicationApiAssertion extends BaseAssertion {
  readonly publicationApiHelper: PublicationApiHelper;

  constructor(publicationApiHelper: PublicationApiHelper) {
    super();
    this.publicationApiHelper = publicationApiHelper;
  }

  public async assertPublishedResourceAvailable(
    resourceType: BackendResourceType,
    resourceUrl: string,
    expectedResult: boolean,
  ) {
    const publishedResourcesList =
      await this.publicationApiHelper.listPublishedResources(resourceType);
    const isResourceAvailable = !!publishedResourcesList.items?.find(
      (i) => i.url === resourceUrl,
    );
    this.assertBooleanCondition(
      isResourceAvailable,
      expectedResult,
      PublishingExpectedMessages.publishedResourceIsAvailable(resourceUrl),
    );
  }
}
