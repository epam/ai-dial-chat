import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  FolderPrompt,
} from '@/src/testData';
import { Colors, ColorsWithoutAlpha } from '@/src/ui/domData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let gpt35Model: DialAIEntityModel;
dialTest.beforeAll(async () => {
  gpt35Model = ModelsUtil.getDefaultModel()!;
});

dialTest(
  'Chat is moved from the folder via drag&drop',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    conversations,
    chatBar,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-861');
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();
    await dataInjector.createConversations(
      conversationInFolder.conversations,
      conversationInFolder.folders,
    );
    await dialHomePage.openHomePage({
      iconsToBeLoaded: [gpt35Model.iconUrl],
    });
    await dialHomePage.waitForPageLoaded();
    await folderConversations.expandFolder(conversationInFolder.folders.name);
    await chatBar.drugConversationFromFolder(
      conversationInFolder.folders.name,
      conversationInFolder.conversations[0].name,
    );
    const draggableAreaColor = await chatBar.getDraggableAreaColor();
    expect
      .soft(draggableAreaColor, ExpectedMessages.draggableAreaColorIsValid)
      .toBe(ColorsWithoutAlpha.backgroundAccentSecondary);
    if (isApiStorageType) {
      const respPromise = page.waitForResponse((resp) => {
        return resp.request().method() === 'POST';
      });
      await page.mouse.up();
      await respPromise;
    } else {
      await page.mouse.up();
    }

    expect
      .soft(
        await folderConversations.isFolderEntityVisible(
          conversationInFolder.folders.name,
          conversationInFolder.conversations[0].name,
        ),
        ExpectedMessages.conversationMovedToFolder,
      )
      .toBeFalsy();

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(conversationInFolder.conversations[0].name),
        ExpectedMessages.conversationOfToday,
      )
      .toBeTruthy();

    const folderNameColor = await folderConversations.getFolderNameColor(
      conversationInFolder.folders.name,
    );
    expect
      .soft(folderNameColor[0], ExpectedMessages.folderNameColorIsValid)
      .toBe(Colors.textPrimary);
  },
);

dialTest(
  'Chat is moved using drag&drop to collapsed folder.\n' +
    'Chat is moved using drag&drop to collapsed folder',
  async ({
    dialHomePage,
    conversationData,
    conversations,
    folderConversations,
    localStorageManager,
    dataInjector,
    chatBar,
    setTestIds,
    page,
  }) => {
    setTestIds('EPMRTC-1599', 'EPMRTC-591');
    let conversationToDrop: Conversation;
    let conversation: Conversation;

    await dialTest.step(
      'Prepare nested folders and single conversations outside folder',
      async () => {
        conversationData.resetData();
        conversationToDrop = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        conversation = conversationData.prepareDefaultConversation();
        await localStorageManager.setChatCollapsedSection(
          CollapsedSections.Organization,
        );

        await dataInjector.createConversations([
          conversationToDrop,
          conversation,
        ]);
      },
    );

    await dialTest.step(
      'Open app, drag conversation to collapsed folder and verify folders hierarchy is expanded, background is highlighted',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        for (let i = 1; i <= 3; i++) {
          await chatBar.createNewFolder();
        }
        for (let i = 3; i >= 2; i--) {
          await chatBar.dragAndDropEntityToFolder(
            folderConversations.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(i),
            ),
            folderConversations.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(i - 1),
            ),
          );
        }
        await folderConversations.expandFolder(
          ExpectedConstants.newFolderWithIndexTitle(2),
        );

        await chatBar.dragConversationToFolder(
          ExpectedConstants.newFolderWithIndexTitle(1),
          conversationToDrop.name,
        );
        await folderConversations.waitForFolderGroupIsHighlighted(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        for (let i = 1; i <= 3; i++) {
          await folderConversations
            .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
            .waitFor();
        }
        await page.mouse.up();
      },
    );

    await dialTest.step(
      'Verify conversation is moving to root folder, another conversation remained selected',
      async () => {
        await folderConversations
          .getFolderEntity(
            ExpectedConstants.newFolderWithIndexTitle(1),
            conversationToDrop.name,
          )
          .waitFor();
        const conversationBackgroundColor =
          await conversations.getEntityBackgroundColor(conversation.name);
        expect
          .soft(
            conversationBackgroundColor,
            ExpectedMessages.conversationIsSelected,
          )
          .toBe(Colors.backgroundAccentSecondary);
      },
    );
  },
);

dialTest(
  'Chat is moved using drag&drop to expanded folder',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    conversations,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-941');
    let folderConversation: FolderConversation;
    let conversationToDrop: Conversation;

    await dialTest.step(
      'Prepare folder with 2 conversation inside and 2 single conversations outside folder',
      async () => {
        folderConversation = conversationData.prepareFolderWithConversations(2);
        conversationData.resetData();
        conversationToDrop = conversationData.prepareDefaultConversation();

        await dataInjector.createConversations(
          [...folderConversation.conversations, conversationToDrop],
          folderConversation.folders,
        );
      },
    );

    await dialTest.step(
      'Open app, drag 1st conversation to expanded folder conversation and verify conversation stays in the folder, folder remains expanded, folder name is highlighted',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversationToDrop.name);
        await folderConversations.expandFolder(folderConversation.folders.name);
        await chatBar.dragAndDropConversationToFolderConversation(
          folderConversation.folders.name,
          folderConversation.conversations[1].name,
          conversationToDrop.name,
        );

        const folderConversationsCount =
          await folderConversations.getFolderEntitiesCount(
            folderConversation.folders.name,
          );
        expect
          .soft(folderConversationsCount, ExpectedMessages.folderIsHighlighted)
          .toBe(folderConversation.conversations.length + 1);

        const folderNameColor = await folderConversations.getFolderNameColor(
          folderConversation.folders.name,
        );
        expect
          .soft(folderNameColor[0], ExpectedMessages.folderNameColorIsValid)
          .toBe(Colors.textAccentSecondary);
      },
    );
  },
);

dialTest(
  'Prompt is moved out of the folder via drag&drop',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    prompts,
    promptBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-961');
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    await dataInjector.createPrompts(
      promptInFolder.prompts,
      promptInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await folderPrompts.expandFolder(promptInFolder.folders.name);
    await promptBar.dragAndDropPromptFromFolder(
      promptInFolder.folders.name,
      promptInFolder.prompts[0].name,
      { isHttpMethodTriggered: true },
    );
    expect
      .soft(
        await folderPrompts.isFolderEntityVisible(
          promptInFolder.folders.name,
          promptInFolder.prompts[0].name,
        ),
        ExpectedMessages.promptMovedToFolder,
      )
      .toBeFalsy();

    await expect
      .soft(
        prompts.getEntityByName(promptInFolder.prompts[0].name),
        ExpectedMessages.promptIsVisible,
      )
      .toBeVisible();
  },
);

dialTest(
  'Prompt is moved using drag&drop to collapsed folder',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    promptBar,
    page,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-959');
    let prompt: Prompt;

    await dialTest.step(
      'Prepare nested folders and prompt outside folder',
      async () => {
        prompt = promptData.prepareDefaultPrompt();
        await dataInjector.createPrompts([prompt]);
        await localStorageManager.setPromptCollapsedSection(
          CollapsedSections.Organization,
        );
      },
    );

    await dialTest.step(
      'Drag and drop prompt to root folder name and verify folder is highlighted, prompt stays inside folder, folder is expanded',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        for (let i = 1; i <= 2; i++) {
          await promptBar.createNewFolder();
        }
        await promptBar.dragAndDropEntityToFolder(
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(2),
          ),
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(1),
          ),
        );

        await promptBar.drugPromptToFolder(
          ExpectedConstants.newFolderWithIndexTitle(1),
          prompt.name,
        );
        await folderPrompts
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(2))
          .waitFor();
        await folderPrompts.waitForFolderGroupIsHighlighted(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        if (isApiStorageType) {
          const respPromise = page.waitForResponse((resp) => {
            return resp.request().method() === 'POST';
          });
          await page.mouse.up();
          return respPromise;
        } else {
          await page.mouse.up();
        }
        await expect
          .soft(
            folderPrompts.getFolderEntity(
              ExpectedConstants.newFolderWithIndexTitle(1),
              prompt.name,
            ),
            ExpectedMessages.promptMovedToFolder,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Prompt is moved using drag&drop to expanded folder',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    promptBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-960');
    let promptInFolder: FolderPrompt;
    let prompt: Prompt;

    await dialTest.step(
      'Prepare folder with prompt and prompt outside folder',
      async () => {
        promptInFolder = promptData.preparePromptsInFolder(1);
        promptData.resetData();
        prompt = promptData.prepareDefaultPrompt();
        await dataInjector.createPrompts(
          [...promptInFolder.prompts, prompt],
          promptInFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Drag and drop prompt to prompt inside folder and verify prompt stays inside folder, folder remains expanded',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await folderPrompts.expandFolder(promptInFolder.folders.name);
        await promptBar.drugAndDropPromptToFolderPrompt(
          promptInFolder.folders.name,
          promptInFolder.prompts[0].name,
          prompt.name,
        );
        await expect
          .soft(
            folderPrompts.getFolderEntity(
              promptInFolder.folders.name,
              prompt.name,
            ),
            ExpectedMessages.promptMovedToFolder,
          )
          .toBeVisible();
      },
    );
  },
);
