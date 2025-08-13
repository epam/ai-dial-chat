import {
  Attachment,
  CustomApplicationBuilder,
  PublishRequestBuilder,
} from '@/src/testData';
import {
  ApplicationApiHelper,
  FileApiHelper,
  PublicationApiHelper,
} from '@/src/testData/api';
import { GeneratorUtil } from '@/src/utils/generatorUtil';
import { PublishActions } from '@epam/ai-dial-shared';

export interface CustomAppAttributes {
  name: string;
  version: string;
}

export class CustomApplicationPublishingUtil {
  private customApplicationBuilder: CustomApplicationBuilder;
  private applicationApiHelper: ApplicationApiHelper;
  private publishRequestBuilder: PublishRequestBuilder;
  private publicationApiHelper: PublicationApiHelper;
  private fileApiHelper: FileApiHelper;

  constructor(
    customApplicationBuilder: CustomApplicationBuilder,
    applicationApiHelper: ApplicationApiHelper,
    publishRequestBuilder: PublishRequestBuilder,
    publicationApiHelper: PublicationApiHelper,
    fileApiHelper: FileApiHelper,
  ) {
    this.customApplicationBuilder = customApplicationBuilder;
    this.applicationApiHelper = applicationApiHelper;
    this.publishRequestBuilder = publishRequestBuilder;
    this.publicationApiHelper = publicationApiHelper;
    this.fileApiHelper = fileApiHelper;
  }

  public async publishApplicationWithVersion(
    appName?: string,
    ...namesToExclude: string[]
  ): Promise<CustomAppAttributes> {
    appName = appName ?? GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomApplicationVersion(namesToExclude);
    const applicationWithVersionModel = this.customApplicationBuilder
      .withDisplayName(appName)
      .withDisplayVersion(appVersion)
      .build();
    const app = await this.applicationApiHelper.createApplication(
      applicationWithVersionModel,
    );
    const publishRequest = this.publishRequestBuilder
      .withName(GeneratorUtil.randomPublicationRequestName())
      .withApplicationResource(app, PublishActions.ADD)
      .build();
    const appPublication =
      await this.publicationApiHelper.createPublishRequest(publishRequest);
    await this.publicationApiHelper.approveRequest(appPublication);
    return {
      name: appName,
      version: appVersion,
    };
  }

  public async uploadApplicationIcon() {
    const filename = `${GeneratorUtil.randomString(7)}.svg`;
    const iconUrl = await this.fileApiHelper.putFileWithCustomName(
      filename,
      Attachment.appIconSvg,
    );
    return (
      iconUrl.substring(0, iconUrl.lastIndexOf('/') + 1) +
      encodeURIComponent(filename)
    );
  }
}
