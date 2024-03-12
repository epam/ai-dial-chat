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
    const promptName = name ?? GeneratorUtil.randomString(10);
    return this.promptBuilder.withName(promptName).withId(promptName).build();
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
    const prompt = this.prepareDefaultPrompt(name);
    const folder = this.prepareFolder();
    prompt.folderId = folder.folderId;
    prompt.id = `${folder.folderId}/${prompt.id}`;
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
      prompt.folderId = folder.folderId;
      prompt.id = `${folder.folderId}/${prompt.id}`;
      prompts.push(prompt);
      this.resetData();
    }
    return { prompts: prompts, folders: folder };
  }

  public preparePrompt(content: string, description?: string) {
    const name = GeneratorUtil.randomString(10);
    return this.promptBuilder
      .withId(name)
      .withName(name)
      .withDescription(description ?? '')
      .withContent(content)
      .build();
  }

  public preparePromptsForNestedFolders(nestedFolders: FolderInterface[]) {
    const nestedPrompts: Prompt[] = [];
    for (const item of nestedFolders) {
      const nestedPrompt = this.prepareDefaultPrompt();
      nestedPrompts.push(nestedPrompt);
      nestedPrompt.folderId = item.folderId;
      nestedPrompt.id = `${nestedPrompt.folderId}/${nestedPrompt.name}`;
      this.resetData();
    }
    return nestedPrompts;
  }
}
