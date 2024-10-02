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
    return this.promptBuilder
      .withName(promptName)
      .withId(promptName)
      .withContent(promptName)
      .build();
  }

  public prepareNestedFolder(
    nestedLevel: number,
    folderNames?: Record<number, string>,
  ) {
    return super.prepareNestedFolder(
      nestedLevel,
      FolderType.Prompt,
      folderNames,
    );
  }

  public prepareDefaultPromptInFolder(
    promptName?: string,
    folderName?: string,
  ): FolderPrompt {
    const prompt = this.prepareDefaultPrompt(promptName);
    const folder = this.prepareFolder(folderName);
    prompt.folderId = folder.id;
    prompt.id = `${folder.id}/${prompt.id}`;
    return { prompts: [prompt], folders: folder };
  }

  public preparePromptInFolder(
    content: string,
    description?: string,
    name?: string,
    promptFolder?: FolderInterface,
  ): FolderPrompt {
    const prompt = this.preparePrompt(content, description, name);
    const folder = promptFolder ?? this.prepareFolder();
    prompt.folderId = folder.id;
    prompt.id = `${folder.id}/${prompt.id}`;
    return { prompts: [prompt], folders: folder };
  }

  public preparePromptsInFolder(
    promptsCount: number,
    name?: string,
  ): FolderPrompt {
    const folder = this.prepareFolder(name);
    const prompts: Prompt[] = [];
    for (let i = 1; i <= promptsCount; i++) {
      const prompt = this.prepareDefaultPrompt();
      prompt.folderId = folder.id;
      prompt.id = `${folder.id}/${prompt.id}`;
      prompts.push(prompt);
      this.resetData();
    }
    return { prompts: prompts, folders: folder };
  }

  public preparePrompt(content: string, description?: string, name?: string) {
    const promptName = name ?? GeneratorUtil.randomString(10);
    return this.promptBuilder
      .withId(promptName)
      .withName(promptName)
      .withDescription(description ?? '')
      .withContent(content)
      .build();
  }

  public preparePromptsForNestedFolders(
    nestedFolders: FolderInterface[],
    promptNames?: Record<number, string>,
  ) {
    const nestedPrompts: Prompt[] = [];
    for (let i = 0; i < nestedFolders.length; i++) {
      const nestedPrompt = this.prepareDefaultPrompt(
        promptNames ? promptNames[i + 1] : undefined,
      );
      nestedPrompts.push(nestedPrompt);
      nestedPrompt.folderId = nestedFolders[i].id;
      nestedPrompt.id = `${nestedPrompt.folderId}/${nestedPrompt.name}`;
      this.resetData();
    }
    return nestedPrompts;
  }
}
