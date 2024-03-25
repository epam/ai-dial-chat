import { Prompt } from '@/chat/types/prompt';
import { ExpectedConstants } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

export class PromptBuilder {
  private prompt: Prompt;

  constructor() {
    this.prompt = {
      id: GeneratorUtil.randomString(10),
      name: ExpectedConstants.newPromptTitle(1),
      description: '',
      content: '',
      folderId: '',
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

  withFolderId(folderId: string): PromptBuilder {
    this.prompt.folderId = folderId;
    return this;
  }

  build(): Prompt {
    return this.prompt;
  }
}
