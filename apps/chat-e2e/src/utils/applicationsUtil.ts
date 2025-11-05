import {
  ApiApplicationTypeSchema,
  ApplicationTypeSchemaProperties,
} from '@/chat/types/application-type-schema';
import { EntityEditorAppTypes } from '@/src/testData';

export class ApplicationsUtil {
  public static getApplicationSchemas() {
    return JSON.parse(process.env.APP_SCHEMAS!) as ApiApplicationTypeSchema[];
  }

  public static getAppSchemaByName(appName: EntityEditorAppTypes): string {
    const app = ApplicationsUtil.getApplicationSchemas().find(
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
