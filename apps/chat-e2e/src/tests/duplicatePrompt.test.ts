import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderPrompt,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

const promptContent = `Calculate {{a}} + {{b}}`;
const promptDescr = `line1\nline2`;

dialTest(
  'Duplicate prompt located in recent.\n' +
    'Duplicate prompt located in recent several times to check postfixes',
  async ({
    dialHomePage,
    promptData,
    prompts,
    promptDropdownMenu,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2998', 'EPMRTC-3049');
    let prompt: Prompt;

    await dialTest.step('Prepare prompt', async () => {
      prompt = promptData.preparePrompt(promptContent, promptDescr);
      await dataInjector.createPrompts([prompt]);
    });

    await dialTest.step(
      'Select Duplicate option from prompt context menu twice and verify prompt with incremented index and equal data is created',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (let i = 1; i <= 2; i++) {
          await prompts.openEntityDropdownMenu(prompt.name, i);
          const response = await promptDropdownMenu.selectMenuOption(
            MenuOptions.duplicate,
            {
              triggeredHttpMethod: 'POST',
            },
          );
          const request = await response?.request().postDataJSON();
          await expect
            .soft(
              prompts.getEntityByName(
                ExpectedConstants.entityWithIndexTitle(prompt.name, i),
              ),
              ExpectedMessages.promptIsVisible,
            )
            .toBeVisible();
          expect
            .soft(request.description, ExpectedMessages.promptDescriptionValid)
            .toBe(prompt.description);
          expect
            .soft(request.content, ExpectedMessages.promptContentValid)
            .toBe(prompt.content);
        }
      },
    );
  },
);

dialTest(
  'Duplicate prompt located in folder',
  async ({
    dialHomePage,
    folderPrompts,
    setTestIds,
    promptData,
    promptDropdownMenu,
    dataInjector,
  }) => {
    setTestIds('EPMRTC-2999');
    let folderPrompt: FolderPrompt;

    await dialTest.step('Prepare prompt inside folder', async () => {
      folderPrompt = promptData.preparePromptInFolder(
        promptContent,
        promptDescr,
      );
      await dataInjector.createPrompts(
        folderPrompt.prompts,
        folderPrompt.folders,
      );
    });

    await dialTest.step(
      'Select Duplicate option for prompt context menu and verify prompt with incremented index is created inside same folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderPrompts.expandFolder(folderPrompt.folders.name);
        await folderPrompts.openFolderEntityDropdownMenu(
          folderPrompt.folders.name,
          folderPrompt.prompts[0].name,
        );
        const response = await promptDropdownMenu.selectMenuOption(
          MenuOptions.duplicate,
          {
            triggeredHttpMethod: 'POST',
          },
        );
        const request = await response?.request().postDataJSON();
        await expect
          .soft(
            folderPrompts.getFolderEntity(
              folderPrompt.folders.name,
              ExpectedConstants.entityWithIndexTitle(
                folderPrompt.prompts[0].name,
                1,
              ),
            ),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
        expect
          .soft(request.description, ExpectedMessages.promptDescriptionValid)
          .toBe(folderPrompt.prompts[0].description);
        expect
          .soft(request.content, ExpectedMessages.promptContentValid)
          .toBe(folderPrompt.prompts[0].content);
      },
    );
  },
);
