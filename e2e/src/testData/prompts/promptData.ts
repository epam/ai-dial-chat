import { GeneratorUtil } from '@/e2e/src/utils/generatorUtil';

import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

import { FolderBuilder } from '@/e2e/src/testData/conversationHistory/folderBuilder';
import { PromptBuilder } from '@/e2e/src/testData/prompts/promptBuilder';

export interface FolderPrompt {
  prompts: Prompt[];
  folders: FolderInterface;
}

export class PromptData {
  private promptBuilder: PromptBuilder;
  private folderBuilder: FolderBuilder;

  constructor() {
    this.promptBuilder = new PromptBuilder();
    this.folderBuilder = new FolderBuilder().withType('prompt');
  }

  public resetData() {
    this.promptBuilder = new PromptBuilder();
    this.folderBuilder = new FolderBuilder().withType('prompt');
  }

  public prepareDefaultPrompt() {
    return this.promptBuilder.withName(GeneratorUtil.randomString(10)).build();
  }

  public prepareFolder(name?: string) {
    return this.folderBuilder
      .withName(name ?? GeneratorUtil.randomString(7))
      .build();
  }

  public prepareNestedFolder(nestedLevel: number) {
    const rootFolder = this.prepareFolder();
    this.resetData();
    const foldersHierarchy = [rootFolder];
    for (let i = 1; i <= nestedLevel; i++) {
      const nestedFolder = this.folderBuilder
        .withName(GeneratorUtil.randomString(7))
        .withType('prompt')
        .withFolderId(foldersHierarchy[foldersHierarchy.length - 1].id)
        .build();
      foldersHierarchy.push(nestedFolder);
      this.resetData();
    }
    return foldersHierarchy;
  }

  public prepareDefaultPromptInFolder(name?: string): FolderPrompt {
    const prompt = this.prepareDefaultPrompt();
    const folder = this.prepareFolder(name);
    prompt.folderId = folder.id;
    return { prompts: [prompt], folders: folder };
  }

  public preparePromptInFolder(
    content: string,
    description?: string,
  ): FolderPrompt {
    const prompt = this.preparePrompt(content, description);
    const folder = this.prepareFolder();
    prompt.folderId = folder.id;
    return { prompts: [prompt], folders: folder };
  }

  public preparePromptsInFolder(promptsCount: number): FolderPrompt {
    const folder = this.prepareFolder();
    const prompts: Prompt[] = [];
    for (let i = 1; i <= promptsCount; i++) {
      const prompt = this.prepareDefaultPrompt();
      prompt.folderId = folder.id;
      prompts.push(prompt);
      this.resetData();
    }
    return { prompts: prompts, folders: folder };
  }

  public preparePrompt(content: string, description?: string) {
    return this.promptBuilder
      .withName(GeneratorUtil.randomString(10))
      .withDescription(description ?? '')
      .withContent(content)
      .build();
  }
}
