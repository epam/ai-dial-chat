import { Routes } from '@/chat/constants/routes';
import { ApplicationType } from '@/chat/types/applications';
import { BaseUrlBuilder } from '@/src/testData';
import { EntityEditSteps } from '@/src/ui/webElements';

export class EntityEditorUrlBuilder extends BaseUrlBuilder {
  private readonly entityPath: Routes;

  constructor(entityEditorPath: Routes, step: EntityEditSteps) {
    super('');
    this.entityPath = entityEditorPath;
    this.addParam('step', step);
  }

  withSchema(schema: ApplicationType | string): EntityEditorUrlBuilder {
    this.addParam('schema', schema);
    return this;
  }

  withReturnUrl(returnUrl: string): EntityEditorUrlBuilder {
    this.addParam('returnUrl', returnUrl);
    return this;
  }

  withIsCreate(isCreate = true): EntityEditorUrlBuilder {
    this.addParam('isCreate', isCreate.toString());
    return this;
  }

  build(): string {
    const url = this.baseUrl + this.entityPath + this.buildQueryString();
    this.resetParams();
    return url;
  }
}
