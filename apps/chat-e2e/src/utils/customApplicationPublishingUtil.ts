import { BackendEntity, EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
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

export interface CustomAppAttributes extends DialAIEntityModel {
  backendEntity: BackendEntity;
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
    return appData;
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
    hasIcon?: boolean;
    namesToExclude?: string[];
  }): Promise<CustomAppAttributes> {
    const appName = options?.appName ?? GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomApplicationVersion(
      options?.namesToExclude,
    );
    const builder = this.customApplicationBuilder
      .withDisplayName(appName)
      .withDisplayVersion(appVersion)
      .withInputAttachmentTypes(...(options?.inputAttachmentTypes ?? []));

    let iconUrl;
    if (options?.hasIcon) {
      iconUrl = await this.uploadApplicationIcon();
      builder.withIconUrl(iconUrl);
    }

    const applicationModel = builder.build();
    const backendEntity =
      await this.applicationApiHelper.createApplication(applicationModel);
    return {
      id: backendEntity.url,
      name: appName,
      version: appVersion,
      reference: applicationModel.reference!,
      type: EntityType.Application,
      isDefault: false,
      iconUrl: iconUrl,
      backendEntity: backendEntity,
    };
  }
}
