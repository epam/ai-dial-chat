import { Prompt } from '@/chat/types/prompt';
import { ExpectedConstants } from '@/src/testData';

export interface TestPrompt extends Omit<Prompt, 'folderId'> {
  folderId?: string | undefined;
}

export class PromptBuilder {
  private prompt: TestPrompt;

  constructor() {
    this.prompt = {
      id: '',
      name: ExpectedConstants.newPromptTitle(1),
      description: '',
      content: '',
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

  withFolderId(folderId: undefined | string): PromptBuilder {
    this.prompt.folderId = folderId;
    return this;
  }

  build(): TestPrompt {
    return this.prompt;
  }
}
