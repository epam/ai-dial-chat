import {
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModels,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { ExpectedConstants } from '@/e2e/src/testData';
import { v4 as uuidv4 } from 'uuid';

export class PromptBuilder {
  private prompt: Prompt;

  constructor() {
    this.prompt = {
      id: uuidv4(),
      name: ExpectedConstants.newPromptTitle(1),
      description: '',
      content: '',
      model: OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
      folderId: null,
    };
  }

  getPrompt() {
    return this.prompt;
  }

  withId(id: string): PromptBuilder {
    this.prompt.id = id;
    return this;
  }

  withName(name: string): PromptBuilder {
    this.prompt.name = name;
    return this;
  }

  withDescription(description: string): PromptBuilder {
    this.prompt.description = description;
    return this;
  }

  withContent(content: string): PromptBuilder {
    this.prompt.content = content;
    return this;
  }

  withModel(model: OpenAIEntityModel): PromptBuilder {
    this.prompt.model = model;
    return this;
  }

  withFolderId(folderId: null | string): PromptBuilder {
    this.prompt.folderId = folderId;
    return this;
  }

  build(): Prompt {
    return this.prompt;
  }
}
