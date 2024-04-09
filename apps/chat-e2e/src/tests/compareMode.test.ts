import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  ModelIds,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
let gpt4Model: DialAIEntityModel;
let bisonModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
  bisonModel = ModelsUtil.getModel(ModelIds.BISON_001)!;
});

dialTest(
  'Compare mode button creates two new chats and opens them in compare mode',
  async ({ dialHomePage, setTestIds, chatBar, conversations, compare }) => {
    setTestIds('EPMRTC-537');
    await dialTest.step(
      'Click on compare button on bottom of chat bar and verify compare mode is opened for new two chats',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.openCompareMode();
        await compare.waitForState();
        const chatsCount = await compare.getConversationsCount();
        expect.soft(chatsCount, ExpectedMessages.compareModeOpened).toBe(2);

        const todayConversations = await conversations.getTodayConversations();
        expect
          .soft(todayConversations.length, ExpectedMessages.conversationOfToday)
          .toBe(3);

        todayConversations.forEach((value) =>
          expect
            .soft(value, ExpectedMessages.conversationOfToday)
            .toContain(ExpectedConstants.newConversationTitle),
        );
      },
    );
  },
);

dialTest(
  'Check the list of available conversations.\n' +
    'Chat icon is shown in Select conversation drop down list in compare mode',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    conversations,
    conversationData,
    localStorageManager,
    dataInjector,
    compare,
    compareConversationSelector,
    iconApiHelper,
  }) => {
    setTestIds('EPMRTC-546', 'EPMRTC-383');
    let firstModelConversation: Conversation;
    let secondModelConversation: Conversation;
    let modelConversationInFolder: FolderConversation;
    let thirdModelConversation: Conversation;
    const conversationName = GeneratorUtil.randomString(7);

    await dialTest.step('Prepare three conversations to compare', async () => {
      firstModelConversation = conversationData.prepareDefaultConversation(
        defaultModel,
        conversationName,
      );
      const request = firstModelConversation.messages.find(
        (m) => m.role === 'user',
      )?.content;
      conversationData.resetData();
      secondModelConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          gpt4Model,
          [request!],
          conversationName,
        );
      conversationData.resetData();
      modelConversationInFolder =
        conversationData.prepareDefaultConversationInFolder(
          undefined,
          bisonModel,
          conversationName,
        );
      conversationData.resetData();
      thirdModelConversation = conversationData.prepareDefaultConversation(
        bisonModel,
        conversationName,
      );

      await dataInjector.createConversations(
        [
          firstModelConversation,
          secondModelConversation,
          thirdModelConversation,
          ...modelConversationInFolder.conversations,
        ],
        modelConversationInFolder.folders,
      );
      await localStorageManager.setSelectedConversation(thirdModelConversation);
    });

    await dialTest.step(
      'Open compare mode from 1st chat dropdown menu and verify chats with valid icons available for comparison',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [
            defaultModel.iconUrl,
            gpt4Model.iconUrl,
            bisonModel.iconUrl,
          ],
        });
        await dialHomePage.waitForPageLoaded();
        await conversations.openConversationDropdownMenu(
          thirdModelConversation.name,
          3,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);

        const chatsCount = await compare.getChatMessagesCount();
        expect.soft(chatsCount, ExpectedMessages.compareModeOpened).toBe(1);

        const isConversationToCompareVisible =
          await compare.isConversationToCompareVisible();
        expect
          .soft(
            isConversationToCompareVisible,
            ExpectedMessages.conversationToCompareVisible,
          )
          .toBeTruthy();

        await compareConversationSelector.click();
        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([
            firstModelConversation.name,
            secondModelConversation.name,
            modelConversationInFolder.conversations[0].name,
          ]);

        const compareOptionsIcons =
          await compareConversationSelector.getOptionsIcons();
        const expectedModels = [defaultModel, gpt4Model, bisonModel];
        expect
          .soft(
            compareOptionsIcons.length,
            ExpectedMessages.entitiesIconsCountIsValid,
          )
          .toBe(expectedModels.length);

        for (const expectedModel of expectedModels) {
          const actualOptionIcon = compareOptionsIcons.find((o) =>
            o.entityName.includes(expectedModel.name),
          )!;
          const expectedModelIcon =
            await iconApiHelper.getEntityIcon(expectedModel);
          expect
            .soft(actualOptionIcon.icon, ExpectedMessages.entityIconIsValid)
            .toBe(expectedModelIcon);
        }
      },
    );
  },
);

dialTest(
  'Check the list of No conversations available',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    conversations,
    compareConversationSelector,
    conversationDropdownMenu,
  }) => {
    setTestIds('EPMRTC-540');
    const firstRequest = 'What is EPAM official name?';
    const secondRequest = 'What is DIAL?';
    const thirdRequest = 'Who is EPAM founder?';
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let thirdConversation: Conversation;
    let forthConversation: Conversation;
    let fifthConversation: Conversation;

    await dialTest.step(
      'Prepare five conversations with requests combination',
      async () => {
        firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [firstRequest, secondRequest],
            'firstConv',
          );
        conversationData.resetData();
        secondConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [secondRequest, firstRequest],
            'secondConv',
          );
        conversationData.resetData();
        thirdConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [firstRequest],
            'thirdConv',
          );
        conversationData.resetData();
        forthConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [firstRequest, thirdRequest],
            'forthConv',
          );
        conversationData.resetData();
        fifthConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [firstRequest.toLowerCase(), secondRequest],
            'fifthConv',
          );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
          thirdConversation,
          forthConversation,
          fifthConversation,
        ]);
        await localStorageManager.setSelectedConversation(firstConversation);
      },
    );

    await dialTest.step(
      'Open compare mode for the 1st conversation and verify no options are available for comparison',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openConversationDropdownMenu(
          firstConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);

        await compareConversationSelector.click();
        const selectorPlaceholder =
          await compareConversationSelector.getSelectorPlaceholder();
        expect
          .soft(selectorPlaceholder, ExpectedMessages.noConversationsAvailable)
          .toBe(ExpectedConstants.noConversationsAvailable);

        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([]);
      },
    );
  },
);

dialTest(
  'Search chat in Select conversation drop down.\n' +
    'Select chat from search results in Select conversation drop down',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    conversations,
    conversationData,
    localStorageManager,
    dataInjector,
    compareConversationSelector,
    rightChatHeader,
    compareConversation,
  }) => {
    setTestIds('EPMRTC-536', 'EPMRTC-1168');
    const request = 'What is epam official name';
    const firstSearchTerm = 'epam';
    const secondSearchTerm = 'systems';
    const thirdSearchTerm = 'epam official';
    const underscoreSearchTerm = '_';
    const noResultSearchTerm = 'epaQ';

    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let thirdConversation: Conversation;
    let fourthConversation: Conversation;
    const matchedConversations: string[] = [];

    await dialTest.step(
      'Prepare 4 conversations with the same request but different names',
      async () => {
        firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
            request,
          );
        conversationData.resetData();
        secondConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
            'When was epam officially founded',
          );
        conversationData.resetData();
        thirdConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
            'Renamed epam systems',
          );
        conversationData.resetData();
        fourthConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
            'epam_systems',
          );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
          thirdConversation,
          fourthConversation,
        ]);
        await localStorageManager.setSelectedConversation(firstConversation);
        matchedConversations.push(
          thirdConversation.name,
          secondConversation.name,
          fourthConversation.name,
        );
        matchedConversations.sort();
      },
    );

    await dialTest.step(
      'Open compare mode for the 1st chat and verify all chats are available for comparison in dropdown list',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openConversationDropdownMenu(
          firstConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversation.checkShowAllConversations();
        await compareConversationSelector.click();
        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList.sort(),
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual(matchedConversations);
      },
    );

    await dialTest.step(
      'Type first search term and verify all chats are available for comparison in dropdown list',
      async () => {
        for (const term of [firstSearchTerm, firstSearchTerm.toUpperCase()]) {
          await compareConversationSelector.fillInput(term);
          const conversationsList =
            await compareConversationSelector.getListOptions();
          expect
            .soft(
              conversationsList.sort(),
              ExpectedMessages.conversationsToCompareOptionsValid,
            )
            .toEqual(matchedConversations);
        }
      },
    );

    await dialTest.step(
      'Type second search term and verify chat 3 and 4 are available for comparison in dropdown list',
      async () => {
        await compareConversationSelector.fillInput(secondSearchTerm);
        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList.sort(),
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([thirdConversation.name, fourthConversation.name]);
      },
    );

    await dialTest.step(
      'Type third search term and verify chat 2 is available for comparison in dropdown list',
      async () => {
        await compareConversationSelector.fillInput(thirdSearchTerm);
        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([secondConversation.name]);
      },
    );

    await dialTest.step(
      'Type underscore and verify chat 4 is available for comparison in dropdown list',
      async () => {
        await compareConversationSelector.fillInput(underscoreSearchTerm);
        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([fourthConversation.name]);
      },
    );

    await dialTest.step(
      'Type not matching search term and verify no chats available for comparison in dropdown list',
      async () => {
        await compareConversationSelector.fillInput(noResultSearchTerm);
        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([]);
      },
    );

    await dialTest.step(
      'Delete search term and verify all chats are available for comparison in dropdown list',
      async () => {
        await compareConversationSelector.fillInput('');
        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList.sort(),
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual(matchedConversations);
      },
    );

    await dialTest.step(
      'Select any chat and verify it shown in the input, dropdown list is closed',
      async () => {
        const chatToSelect =
          GeneratorUtil.randomArrayElement(matchedConversations);
        await compareConversationSelector.selectModel(chatToSelect, true);
        await compareConversationSelector.waitForState({
          state: 'hidden',
        });
        const rightHeaderTitle =
          await rightChatHeader.chatTitle.getElementContent();
        expect
          .soft(rightHeaderTitle, ExpectedMessages.headerTitleCorrespondRequest)
          .toBe(chatToSelect);
      },
    );
  },
);
