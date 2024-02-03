import { FolderInterface, FolderType } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import { FolderData } from '@/src/testData/folders/folderData';
import { PromptBuilder } from '@/src/testData/prompts/promptBuilder';
import { GeneratorUtil } from '@/src/utils/generatorUtil';

export interface FolderPrompt {
  prompts: Prompt[];
  folders: FolderInterface;
}

export class PromptData extends FolderData {
  private promptBuilder: PromptBuilder;

  constructor() {
    super(FolderType.Prompt);
    this.promptBuilder = new PromptBuilder();
  }

  public resetData() {
    this.promptBuilder = new PromptBuilder();
    this.resetFolderData();
  }

  public prepareDefaultPrompt(name?: string) {
    return this.promptBuilder
      .withName(name ?? GeneratorUtil.randomString(10))
      .build();
  }

  public prepareDefaultSharedPrompt(name?: string) {
    const prompt = this.prepareDefaultPrompt(name);
    prompt.isShared = true;
    return prompt;
  }

  public prepareNestedFolder(nestedLevel: number) {
    return super.prepareNestedFolder(nestedLevel, FolderType.Prompt);
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

  public preparePromptsForNestedFolders(nestedFolders: FolderInterface[]) {
    const nestedPrompts: Prompt[] = [];
    for (const item of nestedFolders) {
      const nestedPrompt = this.prepareDefaultPrompt();
      nestedPrompts.push(nestedPrompt);
      nestedPrompt.folderId = item.id;
      this.resetData();
    }
    return nestedPrompts;
  }
}
