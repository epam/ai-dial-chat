import { Routes } from '@/chat/constants/routes';
import { ApplicationType } from '@/chat/types/applications';
import {
  MarketplaceEditorSteps,
  ToolsetEditorSteps,
} from '@/src/testData/expectedConstants';
import { BaseUrlBuilder } from '@/src/testData/marketplace/baseUrlBuilder';

export class EntityEditorUrlBuilder extends BaseUrlBuilder {
  private readonly entityPath: Routes;

  constructor(entityEditorPath: Routes) {
    super('');
    this.entityPath = entityEditorPath;
  }

  /** Sets the `step` for the apps editor (Quick app / custom app / etc.). */
  withAppStep(step: MarketplaceEditorSteps): EntityEditorUrlBuilder {
    this.addParam('step', step);
    return this;
  }

  /** Sets the `step` for the toolset editor. */
  withToolsetStep(step: ToolsetEditorSteps): EntityEditorUrlBuilder {
    this.addParam('step', step);
    return this;
  }

  withSchema(schema: ApplicationType | string): EntityEditorUrlBuilder {
    this.addParam('schema', schema);
    return this;
  }

  withId(id: string): EntityEditorUrlBuilder {
    this.addParam('id', id);
    return this;
  }

  withReturnUrl(returnUrl: string): EntityEditorUrlBuilder {
    this.addParam('returnUrl', returnUrl);
    return this;
  }

  withIsCreating(isCreating = 1): EntityEditorUrlBuilder {
    this.addParam('isCreating', isCreating);
    return this;
  }

  build(): string {
    const url = this.baseUrl + this.entityPath + this.buildQueryString();
    this.resetParams();
    return url;
  }
}
