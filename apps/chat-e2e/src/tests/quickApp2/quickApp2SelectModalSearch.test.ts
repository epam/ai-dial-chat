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

dialTest(
  '[Select agents and toolsets] Cursor is set into Search field automatically when user opens the window\n' + // EPMDIAL-4897
    "[Select agents and toolsets] Search string is not cleared if user clicks on agent/toolset's card on 'Select agents and toolsets' modal\n" + // EPMDIAL-4903
    "[Select agents and toolsets] Search string is cleared if user clicks on agent/toolset's name in 'Selected' on 'Select agents and toolsets' modal\n" + // EPMDIAL-4901
    '[Select agents and toolsets] Search string is not cleared if user switches between My workspace and Marketplace\n' + // EPMDIAL-4904
    "[Select agents and toolsets] Search string is cleared if user reopens 'Select agents and toolsets' modal\n" + // EPMDIAL-4902
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
    toolsetApiHelper,
    adminApplicationApiHelper,
    adminToolsetApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    baseAssertion,
    setTestIds,
  }) => {
    dialTest.slow();
    setTestIds(
      'EPMDIAL-4897',
      'EPMDIAL-4903',
      'EPMDIAL-4901',
      'EPMDIAL-4904',
      'EPMDIAL-4902',
      'EPMDIAL-4899',
      'EPMDIAL-4900',
    );
    const agentName = GeneratorUtil.randomApplicationName();
    const toolsetName = GeneratorUtil.randomToolsetName();
    // The published app and toolset share the name, as the ticket requires.
    const publishedName = GeneratorUtil.randomApplicationName();
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
      'Precondition: the admin publishes an app and a toolset with the same name',
      async () => {
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
        await agentAndToolsetSelectModalAssertion.assertGridIsNotEmpty();
        await agentAndToolsetSelectModal.myWorkspaceTab.click();
        // Own items may sit on any page, so the names are collected page by page.
        await agentAndToolsetSelectModalAssertion.assertAllEntityNamesInclude([
          agentName,
          toolsetName,
        ]);
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

dialTest(
  '[Select agents and toolsets] New extended search by name\n' + // EPMDIAL-4909
    '[Select agents and toolsets] more than one space at the end or beginning of the string does not affect the search result\n' + // EPMDIAL-4907
    '[Search in Select agents and toolsets] multiple spaces between sub-strings are treated as one space, not as sub-string\n' + // EPMDIAL-4911
    '[Select agents and toolsets] more than 2 special symbols starting with ! are treated as sub-string\n' + // EPMDIAL-4910
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
    dialTest.slow();
    setTestIds(
      'EPMDIAL-4909',
      'EPMDIAL-4907',
      'EPMDIAL-4911',
      'EPMDIAL-4910',
      'EPMDIAL-4908',
    );
    // The E2E prefix keeps cleanup working; the rest of every name is taken from
    // the ticket, so the search words below stay the ticket's ones.
    const [
      firstAgentName,
      spacedAgentName,
      secondAgentName,
      xAgentName,
      longAgentName,
      twoWordsAgentName,
      specialCharsAgentName,
    ] = [
      'abcdefghij 1',
      'abcd efghij',
      'abcdefghij 2',
      'abcdexfghij',
      'abcdefghijklmnop12345678',
      'quick app',
      'quick_app!@#%&',
    ].map((namePart) => `${applicationNamePrefix}${namePart}`);
    // The version search below must not hit the agents searched by name, so they
    // get a version far away from every searched one (the default is 0.0.1).
    const isolatedVersion = '9.9.9';
    const allAgentNames = [
      firstAgentName,
      spacedAgentName,
      secondAgentName,
      xAgentName,
      longAgentName,
      twoWordsAgentName,
      specialCharsAgentName,
    ];
    // The version is a part of the searchable data, so name and version cross here.
    const versionedAgents = [
      {
        name: `${applicationNamePrefix}newapp quickapp 5.5.5`,
        version: '0.0.1',
      },
      {
        name: `${applicationNamePrefix}newapp quickapp 0.0.1`,
        version: '5.5.5',
      },
      {
        name: `${applicationNamePrefix}Quickapp app updated`,
        version: '5.5.51',
      },
      { name: `${applicationNamePrefix}new app`, version: '5.5.6' },
    ];
    const [nameFiveAgent, versionFiveAgent, updatedAgent, newAgent] =
      versionedAgents.map((agent) => agent.name);
    const quickAppName = GeneratorUtil.randomApplicationName();

    // Fuse.js allows one error per five pattern characters (threshold 0.2), so
    // 'abcdex' still matches 'abcdef...' while 'habcdex1' matches nothing.
    const nameSearchCases: {
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

    const versionSearchCases: {
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
      'Precondition: start from a clean workspace and create the agents to search by name and by version',
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
            customApplicationBuilder
              .withDisplayName(name)
              .withDisplayVersion(isolatedVersion)
              .build(),
          );
        }
        for (const agent of versionedAgents) {
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

    for (const searchCase of nameSearchCases) {
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
        // 'app' is a part of every agent prefix, so the results take several pages.
        for (const searchWord of ['app   ', '   app']) {
          await agentAndToolsetSelectModal.searchInput.fillInInput(searchWord);
          await agentAndToolsetSelectModalAssertion.assertAllEntityNamesInclude(
            [twoWordsAgentName],
          );
        }
      },
    );

    await dialTest.step(
      'Several spaces between sub-strings are treated as one space',
      async () => {
        for (const searchWord of ['quick app', 'quick        app']) {
          await agentAndToolsetSelectModal.searchInput.fillInInput(searchWord);
          await agentAndToolsetSelectModalAssertion.assertAllEntityNamesInclude(
            [twoWordsAgentName],
          );
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

    for (const searchCase of versionSearchCases) {
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
          const searchCase = versionSearchCases.find(
            (versionCase) => versionCase.searchWord === searchWord,
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
