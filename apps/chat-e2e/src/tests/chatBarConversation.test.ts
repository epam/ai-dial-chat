import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  Chronology,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
} from '@/src/testData';
import { Colors, Overflow, Styles } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { ModelsUtil } from '@/src/utils/modelsUtil';
import { expect } from '@playwright/test';

let gpt35Model: DialAIEntityModel;
let gpt4Model: DialAIEntityModel;
let bisonModel: DialAIEntityModel;

const request = 'What is epam official name';
const notMatchingSearchTerm = 'abc';
const secondSearchTerm = 'epam official';
const matchingConversationName = `${secondSearchTerm} name`;
const specialSymbolsName = '_!@$epam official^&()_[]"\'.<>-`~';

dialTest.beforeAll(async () => {
  gpt35Model = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
  bisonModel = ModelsUtil.getModel(ModelIds.BISON_001)!;
});

dialTest(
  'Chat name equals to the first message\n' +
    'Chat sorting. Today for newly created chat',
  async ({ dialHomePage, conversations, chat, setTestIds }) => {
    setTestIds('EPMRTC-583', 'EPMRTC-776');
    await dialHomePage.openHomePage({
      iconsToBeLoaded: [ModelsUtil.getDefaultModel()!.iconUrl],
    });
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    const messageToSend = 'Hi';
    await chat.sendRequestWithButton(messageToSend);
    await conversations.getConversationByName(messageToSend).waitFor();

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(messageToSend),
        ExpectedMessages.conversationOfToday,
      )
      .toBeTruthy();
  },
);

dialTest(
  'Menu for New conversation',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-594');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await conversations.openConversationDropdownMenu(
      ExpectedConstants.newConversationTitle,
    );
    const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual([
        MenuOptions.rename,
        MenuOptions.compare,
        MenuOptions.duplicate,
        MenuOptions.moveTo,
        MenuOptions.delete,
      ]);
  },
);

dialTest(
  'Menu for conversation with history.\n' +
    'Special characters are allowed in chat name',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    localStorageManager,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-595', 'EPMRTC-1276');
    const conversation = conversationData.prepareDefaultConversation(
      gpt35Model,
      '!@$^&()_[] "\'.<>-`~',
    );
    await dataInjector.createConversations([conversation]);
    await localStorageManager.setSelectedConversation(conversation);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.getConversationByName(conversation.name).waitFor();
    await conversations.openConversationDropdownMenu(conversation.name);
    const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual([
        MenuOptions.rename,
        MenuOptions.compare,
        MenuOptions.duplicate,
        MenuOptions.replay,
        MenuOptions.playback,
        MenuOptions.export,
        MenuOptions.moveTo,
        MenuOptions.share,
        MenuOptions.publish,
        MenuOptions.delete,
      ]);
  },
);

//TODO: enable when item modification date is implemented on backend
dialTest.skip(
  'Chat sorting. Yesterday.\n' +
    'Chat sorting. Last 7 days when chat with lastActivityDate is the day before yesterday.\n' +
    'Chat sorting. Last 30 days when chat with lastActivityDate is the 8th day.\n' +
    'Chat sorting. Yesterday chat is moved to Today section after regenerate response.\n' +
    'Chat sorting. Last 7 Days chat is moved to Today section after editing already answered message',
  async ({
    dialHomePage,
    conversations,
    chat,
    chatMessages,
    conversationData,
    dataInjector,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-775',
      'EPMRTC-796',
      'EPMRTC-798',
      'EPMRTC-777',
      'EPMRTC-780',
    );
    const yesterdayConversation = conversationData.prepareYesterdayConversation(
      gpt35Model,
      'yesterday',
    );
    conversationData.resetData();
    const lastWeekConversation = conversationData.prepareLastWeekConversation(
      gpt35Model,
      'last week',
    );
    conversationData.resetData();
    const lastMonthConversation = conversationData.prepareLastMonthConversation(
      gpt35Model,
      'last month',
    );
    await dataInjector.createConversations([
      yesterdayConversation,
      lastWeekConversation,
      lastMonthConversation,
    ]);
    await localStorageManager.setSelectedConversation(yesterdayConversation);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    const yesterdayConversations =
      await conversations.getYesterdayConversations();
    expect
      .soft(
        yesterdayConversations.includes(yesterdayConversation.name),
        ExpectedMessages.conversationOfYesterday,
      )
      .toBeTruthy();

    const lastWeekConversations =
      await conversations.getLastWeekConversations();
    expect
      .soft(
        lastWeekConversations.includes(lastWeekConversation.name),
        ExpectedMessages.conversationOfLastWeek,
      )
      .toBeTruthy();

    const lastMonthConversations =
      await conversations.getLastMonthConversations();
    expect
      .soft(
        lastMonthConversations.includes(lastMonthConversation.name),
        ExpectedMessages.conversationOfLastMonth,
      )
      .toBeTruthy();

    await chatMessages.regenerateResponse();
    let todayConversations = await conversations.getTodayConversations();
    expect
      .soft(todayConversations.length, ExpectedMessages.conversationOfToday)
      .toBe(1);

    const messageToEdit = lastWeekConversation.messages[0].content;
    await conversations.selectConversation(lastWeekConversation.name);
    await chatMessages.openEditMessageMode(messageToEdit);
    await chatMessages.editMessage(messageToEdit, 'updated message');
    todayConversations = await conversations.getTodayConversations();
    expect
      .soft(todayConversations.length, ExpectedMessages.conversationOfToday)
      .toBe(2);

    await conversations.selectConversation(lastMonthConversation.name);
    await chat.sendRequestWithButton('one more test message');
    todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(lastMonthConversation.name),
        ExpectedMessages.conversationOfToday,
      )
      .toBeTruthy();
  },
);

//TODO: enable when item modification date is implemented on backend
dialTest.skip(
  'Chat sorting. Sections can be collapsed and expanded',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1313');
    await dialTest.step(
      'Prepare conversations for all available chronologies',
      async () => {
        const yesterdayConversation =
          conversationData.prepareYesterdayConversation(gpt35Model);
        conversationData.resetData();
        const lastWeekConversation =
          conversationData.prepareLastWeekConversation(gpt35Model);
        conversationData.resetData();
        const lastMonthConversation =
          conversationData.prepareLastMonthConversation(gpt35Model);
        conversationData.resetData();
        const otherConversation =
          conversationData.prepareOlderConversation(gpt35Model);
        await localStorageManager.setConversationHistory(
          yesterdayConversation,
          lastWeekConversation,
          lastMonthConversation,
          otherConversation,
        );
      },
    );

    await dialTest.step(
      'Verify it is possible to expand/collapse random chronology',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });

        const randomChronology = GeneratorUtil.randomArrayElement([
          Chronology.today,
          Chronology.yesterday,
          Chronology.lastSevenDays,
          Chronology.lastThirtyDays,
          Chronology.older,
        ]);
        await conversations.chronologyByTitle(randomChronology).click();

        let chronologyConversations =
          await conversations.getChronologyConversations(randomChronology);
        expect
          .soft(
            chronologyConversations.length,
            ExpectedMessages.chronologyMessageCountIsCorrect,
          )
          .toBe(0);

        await conversations.chronologyByTitle(randomChronology).click();
        chronologyConversations =
          await conversations.getChronologyConversations(randomChronology);
        expect
          .soft(
            chronologyConversations.length,
            ExpectedMessages.chronologyMessageCountIsCorrect,
          )
          .toBe(1);
      },
    );
  },
);

dialTest(
  'Search conversation when no folders',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    dataInjector,
    chatBar,
    chatBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1188');
    const firstSearchTerm = 'EPAM';
    const specialSymbolsSearchTerm = '@';
    const specialSymbolName = 'test' + specialSymbolsSearchTerm + 'chat';

    await dialTest.step(
      'Prepare conversations with different content',
      async () => {
        const firstConversation = conversationData.prepareDefaultConversation(
          gpt4Model,
          matchingConversationName,
        );
        conversationData.resetData();

        const secondConversation = conversationData.prepareDefaultConversation(
          bisonModel,
          specialSymbolName,
        );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
      },
    );

    await dialTest.step(
      'Type not matching search term is "Search conversation..." field and verify no results found',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBarSearch.setSearchValue(notMatchingSearchTerm);
        const noResult =
          await chatBar.noResultFoundIcon.getElementInnerContent();
        expect
          .soft(noResult, ExpectedMessages.noResultsFound)
          .toBe(ExpectedConstants.noResults);
      },
    );

    await dialTest.step(
      'Clear search field and verify all conversations are displayed',
      async () => {
        await chatBarSearch.setSearchValue('');
        const results = await conversations.getTodayConversations();
        expect
          .soft(results.length, ExpectedMessages.searchResultCountIsValid)
          .toBe(3);
      },
    );

    await dialTest.step(
      'Search by first term and verify search results are correct',
      async () => {
        for (const term of [firstSearchTerm, secondSearchTerm]) {
          await chatBarSearch.setSearchValue(term);
          const results = await conversations.getTodayConversations();
          expect
            .soft(results.length, ExpectedMessages.searchResultCountIsValid)
            .toBe(1);
        }
      },
    );

    await dialTest.step(
      'Search by special symbol and verify search results are correct',
      async () => {
        await chatBarSearch.setSearchValue(specialSymbolsSearchTerm);
        const results = await conversations.getTodayConversations();
        expect
          .soft(results.length, ExpectedMessages.searchResultCountIsValid)
          .toBe(1);
      },
    );
  },
);

dialTest(
  'Search conversation located in folders',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    chatBar,
    folderConversations,
    chatBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1201');

    let firstFolder: FolderInterface;
    let secondFolder: FolderInterface;

    await dialTest.step(
      'Prepare conversations in folders with different content',
      async () => {
        firstFolder = conversationData.prepareFolder();
        conversationData.resetData();

        const firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(gpt35Model, [
            request,
          ]);
        firstConversation.folderId = firstFolder.folderId;
        firstConversation.id = `${firstConversation.folderId}/${firstConversation.id}`;
        conversationData.resetData();

        const secondConversation = conversationData.prepareDefaultConversation(
          gpt4Model,
          matchingConversationName,
        );
        secondConversation.folderId = firstFolder.folderId;
        secondConversation.id = `${secondConversation.folderId}/${secondConversation.id}`;
        conversationData.resetData();

        secondFolder = conversationData.prepareFolder();
        conversationData.resetData();

        const thirdConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            bisonModel,
            [request],
            specialSymbolsName,
          );
        thirdConversation.folderId = secondFolder.folderId;
        thirdConversation.id = `${thirdConversation.folderId}/${thirdConversation.id}`;
        conversationData.resetData();

        const fourthConversation =
          conversationData.prepareDefaultConversation(gpt35Model);
        fourthConversation.folderId = secondFolder.folderId;
        fourthConversation.id = `${fourthConversation.folderId}/${fourthConversation.id}`;
        conversationData.resetData();

        await dataInjector.createConversations(
          [
            firstConversation,
            secondConversation,
            thirdConversation,
            fourthConversation,
          ],
          firstFolder,
          secondFolder,
        );
      },
    );

    await dialTest.step(
      'Type not matching search term is "Search conversation..." field and verify no results found',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.createNewFolder();
        await chatBarSearch.setSearchValue(notMatchingSearchTerm);
        const noResult =
          await chatBar.noResultFoundIcon.getElementInnerContent();
        expect
          .soft(noResult, ExpectedMessages.noResultsFound)
          .toBe(ExpectedConstants.noResults);
      },
    );

    await dialTest.step(
      'Clear search field and verify all conversations are displayed',
      async () => {
        await chatBarSearch.setSearchValue('');
        const results = await folderConversations.getFoldersCount();
        expect.soft(results, ExpectedMessages.searchResultCountIsValid).toBe(3);
      },
    );

    await dialTest.step(
      'Search by search term and verify search results are correct, empty folder is not shown',
      async () => {
        await chatBarSearch.setSearchValue(secondSearchTerm);
        let results = await folderConversations.getFolderEntitiesCount(
          firstFolder.name,
        );
        results += await folderConversations.getFolderEntitiesCount(
          secondFolder.name,
        );
        expect
          .soft(results, ExpectedMessages.searchResultCountIsValid)
          .toBe(isApiStorageType ? 2 : 3);

        const isEmptyFolderVisible = await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .isVisible();
        expect
          .soft(isEmptyFolderVisible, ExpectedMessages.folderIsNotVisible)
          .toBeFalsy();
      },
    );
  },
);
