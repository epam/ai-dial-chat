import {
  ApiDetailedApplicationTypeSchema,
  ApplicationTypeSchemaProperties,
} from '@/chat/types/application-type-schema';
import { AppEditorAppTypes } from '@/src/testData';

export class ApplicationsUtil {
  private static readonly appSchemas: ApiDetailedApplicationTypeSchema[] =
    process.env.APP_SCHEMAS ? JSON.parse(process.env.APP_SCHEMAS) : [];

  public static getAppSchemaByName(appName: AppEditorAppTypes): string {
    const app = ApplicationsUtil.appSchemas.find(
      (app) =>
        app[ApplicationTypeSchemaProperties.applicationTypeDisplayName] ===
        appName,
    );
    if (!app) {
      throw new Error('External applications schema is not found!');
    }
    return app.$id;
  }
}
