import dialTest from '@/src/core/dialFixtures';
import {
  EntityEditorAppTypes,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { GeneratorUtil, applicationNamePrefix } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

// Anything that never matches an agent or a toolset name.
const notMatchingSearchWord = 'doubleabracadabra';

dialTest.only(
  '[Select agents and toolsets] Cursor is set into Search field automatically when user opens the window\n' + // EPMDIAL-4897
    "[Select agents and toolsets] Search string is not cleared if user clicks on agent/toolset's card on 'Select agents and toolsets' modal\n" + // EPMDIAL-4903
    "[Select agents and toolsets] Search string is cleared if user clicks on agent/toolset's name in 'Selected' on 'Select agents and toolsets' modal\n" + // EPMDIAL-4901
    '[Select agents and toolsets] Search string is not cleared if user switches between My workspace and Marketplace\n' + // EPMDIAL-4904
    "[Select agents and toolsets] Search string is cleared if user reopens 'Select agents and toolsets' modal", // EPMDIAL-4902
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    agentAndToolsetSelectModalAssertion,
    customApplicationBuilder,
    toolsetBuilder,
    applicationApiHelper,
    toolsetApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds(
      'EPMDIAL-4897',
      'EPMDIAL-4903',
      'EPMDIAL-4901',
      'EPMDIAL-4904',
      'EPMDIAL-4902',
    );
    const agentName = GeneratorUtil.randomApplicationName();
    const toolsetName = GeneratorUtil.randomToolsetName();
    const quickAppName = GeneratorUtil.randomApplicationName();

    await dialTest.step(
      'Precondition: create an agent and a toolset via API',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(agentName).build(),
        );
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetName).build(),
        );
      },
    );

    await dialTest.step(
      'Open Quick app 2.0 creation page and proceed to the App settings step',
      async () => {
        await marketplacePage.openCreateQuickApp2Page({
          updateInstalledEntities: false,
        });
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Open the select modal — the cursor is in the Search field',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
        await baseAssertion.assertIsElementFocused(
          agentAndToolsetSelectModal.searchInput,
          true,
        );
      },
    );

    await dialTest.step(
      'Select the agent so that it stays in the Selected section',
      async () => {
        await agentAndToolsetSelectModal.selectEntities([agentName]);
        await agentAndToolsetSelectModalAssertion.assertSelected([agentName]);
      },
    );

    await dialTest.step(
      'Search the toolset and select/deselect its card — the search string stays',
      async () => {
        await agentAndToolsetSelectModal.searchInput.fillInInput(toolsetName);
        await agentAndToolsetSelectModal.selectEntityByName(toolsetName);
        await baseAssertion.assertInputValue(
          agentAndToolsetSelectModal.searchInput,
          toolsetName,
        );
        await agentAndToolsetSelectModal.selectEntityByName(toolsetName);
        await agentAndToolsetSelectModalAssertion.assertSelected([agentName]);
        await baseAssertion.assertInputValue(
          agentAndToolsetSelectModal.searchInput,
          toolsetName,
        );
      },
    );

    await dialTest.step(
      'Click the agent name in the Selected section — the search string is cleared',
      async () => {
        await agentAndToolsetSelectModal
          .getSelectedChipByName(agentName)
          .click();
        await baseAssertion.assertInputValue(
          agentAndToolsetSelectModal.searchInput,
          '',
        );
      },
    );

    await dialTest.step(
      'Switch between My workspace and Marketplace — the search string stays',
      async () => {
        await agentAndToolsetSelectModal.searchInput.fillInInput(agentName);
        await agentAndToolsetSelectModal.marketplaceTab.click();
        await baseAssertion.assertInputValue(
          agentAndToolsetSelectModal.searchInput,
          agentName,
        );
        await agentAndToolsetSelectModal.myWorkspaceTab.click();
        await baseAssertion.assertInputValue(
          agentAndToolsetSelectModal.searchInput,
          agentName,
        );
      },
    );

    await dialTest.step(
      'Close the modal on Confirm and reopen it — the search string is cleared',
      async () => {
        await agentAndToolsetSelectModal.confirmButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertInputValue(
          agentAndToolsetSelectModal.searchInput,
          '',
        );
      },
    );

    await dialTest.step(
      'Close the modal on Cancel and reopen it — the search string is cleared',
      async () => {
        await agentAndToolsetSelectModal.searchInput.fillInInput(agentName);
        await agentAndToolsetSelectModal.getCancelButton().click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertInputValue(
          agentAndToolsetSelectModal.searchInput,
          '',
        );
      },
    );

    await dialTest.step(
      'Close the modal on X and reopen it — the search string is cleared',
      async () => {
        await agentAndToolsetSelectModal.searchInput.fillInInput(agentName);
        await agentAndToolsetSelectModal.getCloseButton().click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertInputValue(
          agentAndToolsetSelectModal.searchInput,
          '',
        );
      },
    );
  },
);

dialTest.only(
  "[Select agents and toolsets] 'No results found' on both tabs and clear search_word\n" + // EPMDIAL-4899
    "[Select agents and toolsets] 'No results found in My workspace' but exists on 'Marketplace'. 'See results from Marketplace' link is clicked.", // EPMDIAL-4900
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    agentAndToolsetSelectModalAssertion,
    customApplicationBuilder,
    toolsetBuilder,
    applicationApiHelper,
    adminApplicationApiHelper,
    adminToolsetApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4899', 'EPMDIAL-4900');
    const myAgentName = GeneratorUtil.randomApplicationName();
    // The published app and toolset share the name, as the ticket requires.
    const publishedName = GeneratorUtil.randomApplicationName();
    const quickAppName = GeneratorUtil.randomApplicationName();

    await dialTest.step(
      'Precondition: the user has an own agent, and the admin publishes an app and a toolset with the same name',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(myAgentName).build(),
        );

        const adminApp = await adminApplicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(publishedName).build(),
        );
        await adminToolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(publishedName).build(),
        );
        const adminToolset =
          (await adminToolsetApiHelper.getToolset(publishedName))!;
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withApplicationResource(adminApp, PublishActions.ADD)
          .withToolsetResource(adminToolset, PublishActions.ADD)
          .build();
        const publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialTest.step(
      'Open Quick app 2.0 creation page and open the select modal',
      async () => {
        await marketplacePage.openCreateQuickApp2Page({
          updateInstalledEntities: false,
        });
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Search a word that matches nothing — My workspace suggests the Marketplace results',
      async () => {
        await agentAndToolsetSelectModal.searchInput.fillInInput(
          notMatchingSearchWord,
        );
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.noResultsFound,
          'visible',
        );
        await baseAssertion.assertElementContainsText(
          agentAndToolsetSelectModal.noResultsFound,
          ExpectedConstants.noResultsInMyWorkspace,
        );
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.seeResultsFromMarketplaceLink,
          'visible',
        );
      },
    );

    await dialTest.step(
      'The Marketplace tab has no results either and no suggestion link',
      async () => {
        await agentAndToolsetSelectModal.marketplaceTab.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.noResultsFound,
          'visible',
        );
        await baseAssertion.assertElementText(
          agentAndToolsetSelectModal.noResultsFound,
          ExpectedConstants.noResults,
        );
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.seeResultsFromMarketplaceLink,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Clear the search word — both tabs show their items again',
      async () => {
        await agentAndToolsetSelectModal.searchInput.fillInInput('');
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.noResultsFound,
          'hidden',
        );
        await agentAndToolsetSelectModalAssertion.assertDisplayedEntities({
          visible: [publishedName],
        });
        await agentAndToolsetSelectModal.myWorkspaceTab.click();
        await agentAndToolsetSelectModalAssertion.assertDisplayedEntities({
          visible: [myAgentName],
        });
      },
    );

    await dialTest.step(
      'Search the published name — it is not in My workspace',
      async () => {
        await agentAndToolsetSelectModal.searchInput.fillInInput(publishedName);
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.noResultsFound,
          'visible',
        );
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.seeResultsFromMarketplaceLink,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click See results from Marketplace — the Marketplace tab shows the published app and toolset only',
      async () => {
        await agentAndToolsetSelectModal.seeResultsFromMarketplaceLink.click();
        await agentAndToolsetSelectModalAssertion.assertTabIsActive(
          agentAndToolsetSelectModal.marketplaceTab,
        );
        await baseAssertion.assertElementsCount(
          agentAndToolsetSelectModal.getEntities(),
          2,
          ExpectedMessages.searchResultCountIsValid,
        );
      },
    );
  },
);

dialTest.only(
  '[Select agents and toolsets] New extended search by name\n' + // EPMDIAL-4909
    '[Select agents and toolsets] more than one space at the end or beginning of the string does not affect the search result\n' + // EPMDIAL-4907
    '[Search in Select agents and toolsets] multiple spaces between sub-strings are treated as one space, not as sub-string\n' + // EPMDIAL-4911
    '[Select agents and toolsets] more than 2 special symbols starting with ! are treated as sub-string', // EPMDIAL-4910
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    agentAndToolsetSelectModalAssertion,
    customApplicationBuilder,
    applicationApiHelper,
    fileApiHelper,
    mainUserShareApiHelper,
    localStorageManager,
    baseAssertion,
    setTestIds,
  }) => {
    dialTest.slow();
    setTestIds('EPMDIAL-4909', 'EPMDIAL-4907', 'EPMDIAL-4911', 'EPMDIAL-4910');
    // The seed keeps the names unique; it sits right after the E2E prefix so that
    // the meaningful part of every name stays untouched by it.
    const seed = GeneratorUtil.randomString(5);
    const namePrefix = `${applicationNamePrefix}${seed}`;
    const [
      firstAgentName,
      spacedAgentName,
      secondAgentName,
      xAgentName,
      longAgentName,
    ] = [
      'abcdefghij 1',
      'abcd efghij',
      'abcdefghij 2',
      'abcdexfghij',
      'abcdefghijklmnop12345678',
    ].map((namePart) => `${namePrefix}${namePart}`);
    // Two words in the name: the multi-space search is checked against them.
    const twoWordsAgentName = `${namePrefix}quick ${seed}`;
    const specialCharsAgentName = `${namePrefix}quick_app!@#%&`;
    const allAgentNames = [
      firstAgentName,
      spacedAgentName,
      secondAgentName,
      xAgentName,
      longAgentName,
      twoWordsAgentName,
      specialCharsAgentName,
    ];
    const quickAppName = GeneratorUtil.randomApplicationName();

    // Fuse.js allows one error per five pattern characters (threshold 0.2), so
    // 'abcdex' still matches 'abcdef...' while 'habcdex1' matches nothing.
    const searchCases: {
      searchWord: string;
      visible: string[];
      hidden: string[];
    }[] = [
      {
        searchWord: 'abcd',
        visible: [
          firstAgentName,
          spacedAgentName,
          secondAgentName,
          xAgentName,
          longAgentName,
        ],
        hidden: [],
      },
      {
        searchWord: 'abcd   ',
        visible: [
          firstAgentName,
          spacedAgentName,
          secondAgentName,
          xAgentName,
          longAgentName,
        ],
        hidden: [],
      },
      {
        searchWord: 'abcd ef',
        visible: [
          firstAgentName,
          spacedAgentName,
          secondAgentName,
          longAgentName,
        ],
        hidden: [xAgentName],
      },
      {
        searchWord: 'abcdex',
        visible: [firstAgentName, secondAgentName, xAgentName, longAgentName],
        hidden: [spacedAgentName],
      },
      {
        searchWord: 'abcdext',
        visible: [xAgentName],
        hidden: [
          firstAgentName,
          spacedAgentName,
          secondAgentName,
          longAgentName,
        ],
      },
      {
        searchWord: 'habcdex',
        visible: [xAgentName],
        hidden: [
          firstAgentName,
          spacedAgentName,
          secondAgentName,
          longAgentName,
        ],
      },
      {
        searchWord: 'habcdex1',
        visible: [],
        hidden: [
          firstAgentName,
          spacedAgentName,
          secondAgentName,
          xAgentName,
          longAgentName,
        ],
      },
    ];

    await dialTest.step(
      'Precondition: start from a clean workspace and create the agents to search for',
      async () => {
        const sharedApps = await mainUserShareApiHelper.listSharedWithMeApps();
        await mainUserShareApiHelper.deleteSharedWithMeEntities(
          sharedApps.resources,
        );
        await fileApiHelper.updateInstalledDeployments([]);
        await fileApiHelper.updateInstalledToolsets([]);
        await localStorageManager.setRecentModelsIds();

        for (const name of allAgentNames) {
          await applicationApiHelper.createApplication(
            customApplicationBuilder.withDisplayName(name).build(),
          );
        }
      },
    );

    await dialTest.step(
      'Open Quick app 2.0 creation page and open the select modal',
      async () => {
        await marketplacePage.openCreateQuickApp2Page({
          updateInstalledEntities: false,
        });
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
      },
    );

    for (const searchCase of searchCases) {
      await dialTest.step(
        `Search '${searchCase.searchWord}' — the matching agents are shown on both tabs`,
        async () => {
          await agentAndToolsetSelectModal.searchInput.fillInInput(
            searchCase.searchWord,
          );
          for (const tab of [
            agentAndToolsetSelectModal.myWorkspaceTab,
            agentAndToolsetSelectModal.marketplaceTab,
          ]) {
            await tab.click();
            await agentAndToolsetSelectModalAssertion.assertDisplayedEntities({
              visible: searchCase.visible,
              hidden: searchCase.hidden,
            });
            if (!searchCase.visible.length) {
              await baseAssertion.assertElementState(
                agentAndToolsetSelectModal.noResultsFound,
                'visible',
              );
            }
          }
          await agentAndToolsetSelectModal.myWorkspaceTab.click();
        },
      );
    }

    await dialTest.step(
      'Extra spaces at the beginning and at the end do not affect the search result',
      async () => {
        for (const searchWord of [
          `${twoWordsAgentName}   `,
          `   ${twoWordsAgentName}`,
        ]) {
          await agentAndToolsetSelectModal.searchInput.fillInInput(searchWord);
          await agentAndToolsetSelectModalAssertion.assertDisplayedEntities({
            visible: [twoWordsAgentName],
          });
        }
      },
    );

    await dialTest.step(
      'Several spaces between sub-strings are treated as one space',
      async () => {
        for (const searchWord of [`quick ${seed}`, `quick        ${seed}`]) {
          await agentAndToolsetSelectModal.searchInput.fillInInput(searchWord);
          await agentAndToolsetSelectModalAssertion.assertDisplayedEntities({
            visible: [twoWordsAgentName],
          });
        }
      },
    );

    await dialTest.step(
      'Special symbols starting with ! are treated as a sub-string',
      async () => {
        await agentAndToolsetSelectModal.searchInput.fillInInput('!@#%&');
        await agentAndToolsetSelectModalAssertion.assertDisplayedEntities({
          visible: [specialCharsAgentName],
        });
      },
    );
  },
);

dialTest.only(
  '[Select agents and toolsets] New extended search by name and version', // EPMDIAL-4908
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    agentAndToolsetSelectModalAssertion,
    customApplicationBuilder,
    applicationApiHelper,
    fileApiHelper,
    mainUserShareApiHelper,
    localStorageManager,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4908');
    const seed = GeneratorUtil.randomString(5);
    const namePrefix = `${applicationNamePrefix}${seed}`;
    // The version is a part of the searchable data, so name and version cross here.
    const agents = [
      { name: `${namePrefix}newapp quickapp 5.5.5`, version: '0.0.1' },
      { name: `${namePrefix}newapp quickapp 0.0.1`, version: '5.5.5' },
      { name: `${namePrefix}Quickapp app updated`, version: '5.5.51' },
      { name: `${namePrefix}new app`, version: '5.5.6' },
    ];
    const [nameFiveAgent, versionFiveAgent, updatedAgent, newAgent] =
      agents.map((agent) => agent.name);
    const quickAppName = GeneratorUtil.randomApplicationName();

    const searchCases: {
      searchWord: string;
      visible: string[];
      hidden: string[];
    }[] = [
      {
        searchWord: '5.5.5',
        visible: [nameFiveAgent, versionFiveAgent, updatedAgent, newAgent],
        hidden: [],
      },
      {
        searchWord: '0.0.1   ',
        visible: [nameFiveAgent, versionFiveAgent],
        hidden: [updatedAgent, newAgent],
      },
      {
        searchWord: '5.5.6',
        visible: [nameFiveAgent, versionFiveAgent, updatedAgent, newAgent],
        hidden: [],
      },
      {
        searchWord: '5.5.51',
        visible: [nameFiveAgent, versionFiveAgent, updatedAgent],
        hidden: [newAgent],
      },
      {
        searchWord: '5.5.515',
        visible: [updatedAgent],
        hidden: [nameFiveAgent, versionFiveAgent, newAgent],
      },
      {
        searchWord: '5.5.5155',
        visible: [],
        hidden: [nameFiveAgent, versionFiveAgent, updatedAgent, newAgent],
      },
    ];

    await dialTest.step(
      'Precondition: start from a clean workspace and create the agents with the versions to search for',
      async () => {
        const sharedApps = await mainUserShareApiHelper.listSharedWithMeApps();
        await mainUserShareApiHelper.deleteSharedWithMeEntities(
          sharedApps.resources,
        );
        await fileApiHelper.updateInstalledDeployments([]);
        await fileApiHelper.updateInstalledToolsets([]);
        await localStorageManager.setRecentModelsIds();

        for (const agent of agents) {
          await applicationApiHelper.createApplication(
            customApplicationBuilder
              .withDisplayName(agent.name)
              .withDisplayVersion(agent.version)
              .build(),
          );
        }
      },
    );

    await dialTest.step(
      'Open Quick app 2.0 creation page and open the select modal',
      async () => {
        await marketplacePage.openCreateQuickApp2Page({
          updateInstalledEntities: false,
        });
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
      },
    );

    for (const searchCase of searchCases) {
      await dialTest.step(
        `Search '${searchCase.searchWord}' — the agents matching by name or version are shown`,
        async () => {
          await agentAndToolsetSelectModal.searchInput.fillInInput(
            searchCase.searchWord,
          );
          await agentAndToolsetSelectModalAssertion.assertDisplayedEntities({
            visible: searchCase.visible,
            hidden: searchCase.hidden,
          });
          if (!searchCase.visible.length) {
            await baseAssertion.assertElementState(
              agentAndToolsetSelectModal.noResultsFound,
              'visible',
            );
          }
        },
      );
    }

    await dialTest.step(
      'The Marketplace tab returns the same matches for the distinctive versions',
      async () => {
        await agentAndToolsetSelectModal.marketplaceTab.click();
        for (const searchWord of ['5.5.51', '5.5.515']) {
          const searchCase = searchCases.find(
            (c) => c.searchWord === searchWord,
          )!;
          await agentAndToolsetSelectModal.searchInput.fillInInput(searchWord);
          await agentAndToolsetSelectModalAssertion.assertDisplayedEntities({
            visible: searchCase.visible,
            hidden: searchCase.hidden,
          });
        }
      },
    );
  },
);
