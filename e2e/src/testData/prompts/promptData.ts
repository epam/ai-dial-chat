import { GeneratorUtil } from '@/e2e/src/utils/generatorUtil';

import { FolderBuilder } from '@/e2e/src/testData/conversationHistory/folderBuilder';
import { PromptBuilder } from '@/e2e/src/testData/prompts/promptBuilder';

export class PromptData {
  private promptBuilder: PromptBuilder;
  private folderBuilder: FolderBuilder;

  constructor() {
    this.promptBuilder = new PromptBuilder();
    this.folderBuilder = new FolderBuilder().withType('prompt');
  }

  public resetData() {
    return new PromptData();
  }

  public prepareDefaultPrompt() {
    return this.promptBuilder
      .withName('test prompt' + GeneratorUtil.randomIntegerNumber())
      .build();
  }

  public prepareDefaultFolder() {
    return this.folderBuilder.build();
  }

  public prepareFolder(name?: string) {
    return this.folderBuilder
      .withName(name ?? GeneratorUtil.randomString(7))
      .build();
  }

  public prepareDefaultPromptInFolder() {
    const prompt = this.prepareDefaultPrompt();
    const folder = this.prepareDefaultFolder();
    prompt.folderId = folder.id;
    return { prompts: prompt, folders: folder };
  }
}
