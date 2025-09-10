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
  private fileApiHelper: FileApiHelper;
  private publishRequestBuilder?: PublishRequestBuilder;
  private publicationApiHelper?: PublicationApiHelper;

  constructor(
    customApplicationBuilder: CustomApplicationBuilder,
    applicationApiHelper: ApplicationApiHelper,
    fileApiHelper: FileApiHelper,
    publishRequestBuilder?: PublishRequestBuilder,
    publicationApiHelper?: PublicationApiHelper,
  ) {
    this.customApplicationBuilder = customApplicationBuilder;
    this.applicationApiHelper = applicationApiHelper;
    this.publishRequestBuilder = publishRequestBuilder;
    this.publicationApiHelper = publicationApiHelper;
    this.fileApiHelper = fileApiHelper;
  }

  public async publishApplicationWithVersion(options?: {
    appName?: string;
    namesToExclude?: string[];
  }): Promise<CustomAppAttributes> {
    const appData = await this.createCustomApp(options);
    const publishRequest = this.publishRequestBuilder!.withName(
      GeneratorUtil.randomPublicationRequestName(),
    )
      .withApplicationResource(appData.backendEntity, PublishActions.ADD)
      .build();
    const appPublication =
      await this.publicationApiHelper!.createPublishRequest(publishRequest);
    await this.publicationApiHelper!.approveRequest(appPublication);
    return {
      name: appData.name,
      version: appData.version,
    };
  }

  public async uploadApplicationIcon() {
    const filename = `${GeneratorUtil.randomString(7)}.svg`;
    const iconUrl = await this.fileApiHelper!.putFileWithCustomName(
      filename,
      Attachment.appIconSvg,
    );
    return (
      iconUrl.substring(0, iconUrl.lastIndexOf('/') + 1) +
      encodeURIComponent(filename)
    );
  }

  public async createCustomApp(options?: {
    appName?: string;
    inputAttachmentTypes?: string[];
    iconUrl?: string;
    namesToExclude?: string[];
  }) {
    const appName = options?.appName ?? GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomApplicationVersion(
      options?.namesToExclude,
    );
    const builder = this.customApplicationBuilder
      .withDisplayName(appName)
      .withDisplayVersion(appVersion)
      .withInputAttachmentTypes(...(options?.inputAttachmentTypes ?? []));
    if (options?.iconUrl) {
      builder.withIconUrl(options?.iconUrl);
    }
    const applicationModel = builder.build();
    const backendEntity =
      await this.applicationApiHelper.createApplication(applicationModel);
    return {
      backendEntity: backendEntity,
      name: appName,
      version: appVersion,
      reference: applicationModel.reference!,
      iconUrl: options?.iconUrl,
    };
  }
}
