import dialTest from '@/src/core/dialFixtures';
import {
  API,
  AccountMenuOptions,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import {
  Attributes,
  StyleValues,
  Styles,
  ThemeColorAttributes,
} from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import {
  GeneratorUtil,
  ModelsUtil,
  SortingUtil,
  applicationNamePrefix,
} from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Locator } from '@playwright/test';

dialTest(
  `Start chat with: 'Default agent' setting is set for new user.\n` +
    'Start chat with: Default agent is always pre-set for new conversation',
  async ({
    dialHomePage,
    accountSettings,
    accountDropdownMenu,
    settingsModal,
    settingsModalAssertion,
    agentInfoAssertion,
    header,
    chat,
    talkToAgentDialog,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-6436', 'EPMRTC-6444');
    const defaultAgent = ModelsUtil.getDefaultAgent()!;
    const randomModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getModels(),
    );

    await dialTest.step(
      'Open DIAL and verify default agent is set for a new conversation',
      async () => {
        await localStorageManager.setRecentModelsIds(defaultAgent, randomModel);
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await agentInfoAssertion.assertAgentName(defaultAgent.name);
        await agentInfoAssertion.assertAgentVersion(defaultAgent.version);
      },
    );

    await dialTest.step(
      'Open account settings and and verify "Start chat with" value',
      async () => {
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModalAssertion.assertStartChatWithSelectedValue(
          ExpectedConstants.defaultAgentLabel,
        );
        await settingsModal.cancelButton.click();
      },
    );

    await dialTest.step('Change the agent and send a new request', async () => {
      await dialHomePage.mockChatTextResponse(
        MockedChatApiResponseBodies.simpleTextBody,
      );
      await chat.changeAgentButton.click();
      await talkToAgentDialog.selectAgent(randomModel);
      await chat.sendRequestWithButton(GeneratorUtil.randomString(5));
    });

    await dialTest.step(
      'Create new conversation and verify default agent is set for a new conversation',
      async () => {
        await header.createNewConversation();
        await agentInfoAssertion.assertAgentName(defaultAgent.name);
        await agentInfoAssertion.assertAgentVersion(defaultAgent.version);
      },
    );
  },
);

dialTest(
  'Start chat with: drop down list is available when agent is set.\n' +
    'Start chat with: sorting order in the drop down list.\n' +
    `Start chat with: selected agent is moved to the top of the drop down list. 'Default agent' and 'Last used agent' are always at the top.\n` +
    'Start chat with: agent name contains the icon, name and version.\n' +
    'Start chat with: long item name is cut with ....\n' +
    'Start chat with: tooltip on hover.\n' +
    'Start chat with: Exact agent is always pre-set for new conversation',
  async (
    {
      dialHomePage,
      accountSettings,
      providerLogin,
      accountDropdownMenu,
      settingsModal,
      chat,
      agentInfoAssertion,
      talkToAgentDialog,
      customApplicationBuilder,
      applicationApiHelper,
      settingsModalAssertion,
      fileApiHelper,
      tooltip,
      tooltipAssertion,
      setTestIds,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-6437',
      'EPMRTC-6439',
      'EPMRTC-6440',
      'EPMRTC-6442',
      'EPMRTC-6438',
      'EPMRTC-6441',
      'EPMRTC-6449',
    );

    const commonPart = GeneratorUtil.randomString(7);
    const firstAppName = `${applicationNamePrefix}1 ${commonPart}`;
    const secondAppName = `${applicationNamePrefix}W ${commonPart}`;
    const secondAppSecondVersion = '1.1.1';
    const secondAppThirdVersion = '0.1.1';
    const thirdAppName = `${applicationNamePrefix}a ${commonPart}`;
    let iconUrl: string;
    let expectedIconUrl: string;
    let agentToSelectElement: Locator;

    await dialTest.step('Upload images to the root path', async () => {
      iconUrl = await fileApiHelper.putFile(Attachment.appIconSvg);
      expectedIconUrl = `/api/${iconUrl}`;
    });

    await dialTest.step(
      'Prepare custom applications with different names and versions via API',
      async () => {
        const firstApplicationModel = customApplicationBuilder
          .withDisplayName(firstAppName)
          .build();
        const secondApplicationFirstVersionModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .build();
        const secondApplicationSecondVersionModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withIconUrl(iconUrl)
          .withDisplayVersion(secondAppSecondVersion)
          .build();
        const secondApplicationThirdVersionModel = customApplicationBuilder
          .withDisplayName(secondAppName)
          .withDisplayVersion(secondAppThirdVersion)
          .build();
        const thirdApplicationModel = customApplicationBuilder
          .withDisplayName(thirdAppName)
          .build();
        for (const app of [
          firstApplicationModel,
          secondApplicationFirstVersionModel,
          secondApplicationSecondVersionModel,
          secondApplicationThirdVersionModel,
          thirdApplicationModel,
        ]) {
          await applicationApiHelper.createApplication(app);
        }
      },
    );

    await dialTest.step(
      'Open account settings, expand "Start chat with" menu and verify the list is expanded',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModal.startChatWithToggle.click();
        await settingsModalAssertion.assertElementAttribute(
          settingsModal.startChatWithToggle,
          Attributes.ariaExpanded,
          'true',
        );
        await settingsModalAssertion.assertElementState(
          settingsModal.startChatWithListbox,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify "Default agent" and "Last used agent" options stay on the top, created agents are sorted by name and version desc',
      async () => {
        const allOptions = await settingsModal.getAllOptions();
        settingsModalAssertion.assertValue(
          allOptions[0].name,
          ExpectedConstants.defaultAgentLabel,
        );
        settingsModalAssertion.assertValue(
          allOptions[1].name,
          ExpectedConstants.lastUsedAgentLabel,
        );
        const customAppsArray = allOptions
          .slice(2)
          .filter(
            (o) =>
              o.name === firstAppName ||
              o.name === secondAppName ||
              o.name === thirdAppName,
          );
        const sortedCustomAppsArray = SortingUtil.sortNameVersionArray(
          customAppsArray,
          'asc',
        );
        settingsModalAssertion.assertValuesAreEqual(
          customAppsArray,
          sortedCustomAppsArray,
        );
      },
    );

    await dialTest.step(
      'Verify custom apps default and custom icons',
      async () => {
        const secondAppIcon = settingsModal.startChatWithListboxAgentIcon({
          name: secondAppName,
          version: secondAppSecondVersion,
        });
        await settingsModalAssertion.assertEntityIcon(
          secondAppIcon,
          expectedIconUrl,
        );

        const firstAppIcon = settingsModal.startChatWithListboxAgentIcon({
          name: firstAppName,
          version: ExpectedConstants.defaultAppVersion,
        });
        await settingsModalAssertion.assertEntityIcon(
          firstAppIcon,
          API.defaultModelIconHost(),
        );
      },
    );

    await dialTest.step(
      'Verify list options are truncated with the dots',
      async () => {
        agentToSelectElement =
          settingsModal.startChatWithListboxAgentAttributes({
            name: secondAppName,
            version: secondAppSecondVersion,
          });
        await settingsModalAssertion.assertElementTextIsTruncated(
          agentToSelectElement,
        );
      },
    );

    await dialTest.step(
      'Hover over any app and verify tooltip with fully visible name+version is shown',
      async () => {
        await agentToSelectElement.hover();
        await tooltipAssertion.assertElementState(tooltip);
        await tooltipAssertion.assertTooltipContent(
          settingsModal.optionAttributes({
            name: secondAppName,
            version: secondAppSecondVersion,
          }),
        );
        await tooltipAssertion.assertEntityIcon(
          tooltip.tooltipIcon,
          expectedIconUrl,
        );
        await tooltipAssertion.assertTooltipStyle(
          Styles.overflow_wrap,
          StyleValues.breakWord,
        );
      },
    );

    await dialTest.step(
      'Select the app with custom icon and verify the list is collapsed',
      async () => {
        await agentToSelectElement.click();
        await settingsModalAssertion.assertElementAttribute(
          settingsModal.startChatWithToggle,
          Attributes.ariaExpanded,
          'false',
        );
        await settingsModalAssertion.assertElementState(
          settingsModal.startChatWithListbox,
          'hidden',
        );
        await settingsModalAssertion.assertStartChatWithSelectedValue({
          name: secondAppName,
          version: secondAppSecondVersion,
        });
        await settingsModalAssertion.assertEntityIcon(
          settingsModal.startChatWithAgentIcon,
          expectedIconUrl,
        );
      },
    );

    await dialTest.step(
      'Verify selected option is truncated with the dots',
      async () => {
        await settingsModalAssertion.assertElementTextIsTruncated(
          settingsModal.startChatWithAgentAttributes,
        );
      },
    );

    await dialTest.step(
      'Hover over selected app and verify tooltip with fully visible name+version is shown',
      async () => {
        await settingsModal.startChatWithSelectedAgent.hoverOver();
        await tooltipAssertion.assertElementState(tooltip);
        await tooltipAssertion.assertTooltipContent(
          settingsModal.optionAttributes({
            name: secondAppName,
            version: secondAppSecondVersion,
          }),
        );
        await tooltipAssertion.assertEntityIcon(
          tooltip.tooltipIcon,
          expectedIconUrl,
        );
        await tooltipAssertion.assertTooltipStyle(
          Styles.overflow_wrap,
          StyleValues.breakWord,
        );
      },
    );

    await dialTest.step(
      'Expand the list again and verify all the agents are displayed, selected agent stays at the third place',
      async () => {
        await settingsModal.startChatWith.click();
        await settingsModalAssertion.assertElementState(
          settingsModal.startChatWithListbox,
          'visible',
        );
        const allOptions = await settingsModal.getAllOptions();
        const expectedModels = ModelsUtil.getModels().map((m) => ({
          name: m.name,
          version: m.version ?? '',
        }));
        settingsModalAssertion.assertArrayIncludesAll(
          allOptions,
          expectedModels,
          ExpectedMessages.allAgentsListIsValid,
        );

        settingsModalAssertion.assertValue(allOptions[2].name, secondAppName);
        settingsModalAssertion.assertValue(
          allOptions[2].version,
          secondAppSecondVersion,
        );
        await settingsModalAssertion.assertElementBackgroundColors(
          settingsModal.startChatWithListboxAgent({
            name: secondAppName,
            version: secondAppSecondVersion,
          }),
          ThemesUtil.getRgbColorByKey(
            ThemeColorAttributes.bgAccentPrimaryAlpha,
          ),
        );
        await settingsModal.startChatWith.click();
      },
    );

    await dialTest.step(
      'Save changes, re-login and verify selected app is applied for a new conversation',
      async () => {
        await settingsModal.saveButton.click();
        await accountSettings.logout();
        await providerLogin.login(
          testInfo,
          process.env.E2E_USERNAME!.split(',')[+testInfo.parallelIndex],
          process.env.E2E_PASSWORD!,
          false,
        );
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await agentInfoAssertion.assertAgentName(secondAppName);
        await agentInfoAssertion.assertAgentVersion(secondAppSecondVersion);
      },
    );

    await dialTest.step(
      'Change agent and send a request to the chat',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(firstAppName);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(GeneratorUtil.randomString(5));
      },
    );

    await dialTest.step(
      'Reload the page and verify selected agent is used',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await agentInfoAssertion.assertAgentName(secondAppName);
        await agentInfoAssertion.assertAgentVersion(secondAppSecondVersion);
      },
    );
  },
);

dialTest(
  'Start chat with: Search',
  async ({
    dialHomePage,
    accountSettings,
    accountDropdownMenu,
    settingsModal,
    page,
    customApplicationBuilder,
    applicationApiHelper,
    settingsModalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-6443');

    const commonPart = GeneratorUtil.randomApplicationName();
    const firstAppName = `${commonPart}1`;
    const secondAppName = `${commonPart.toUpperCase()}2`;

    await dialTest.step(
      'Prepare custom applications with common part in the name names via API',
      async () => {
        for (const appName of [firstAppName, secondAppName]) {
          const applicationModel = customApplicationBuilder
            .withDisplayName(appName)
            .build();
          await applicationApiHelper.createApplication(applicationModel);
        }
      },
    );

    await dialTest.step(
      'Open account settings, set not existent term in the "Start chat with" field and verify "No available items" label is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModal.startChatWithSearchInput.typeInInput(
          GeneratorUtil.randomString(10),
        );
        await settingsModalAssertion.assertElementState(
          settingsModal.noAvailableItems,
          'visible',
        );
        await settingsModalAssertion.assertElementText(
          settingsModal.noAvailableItems,
          ExpectedConstants.noAvailableItemsLabel,
        );
      },
    );

    await dialTest.step(
      'Set common term in the "Start chat with" field and verify two apps are found',
      async () => {
        await page.keyboard.press(keys.ctrlPlusA);
        await settingsModal.startChatWithSearchInput.typeInInput(commonPart);
        await settingsModal.startChatWithListboxOptions
          .getNthElement(2)
          .waitFor();
        const allOptions = await settingsModal.getAllOptions();
        settingsModalAssertion.assertValuesAreEqual(allOptions, [
          {
            name: firstAppName,
            version: ExpectedConstants.defaultAppVersion,
          },
          {
            name: secondAppName,
            version: ExpectedConstants.defaultAppVersion,
          },
        ]);
      },
    );

    await dialTest.step(
      'Continue typing the app name and verify one app is found',
      async () => {
        await settingsModal.startChatWithSearchInput.typeInInput('1');
        await settingsModal.startChatWithListboxOptions
          .getNthElement(1)
          .waitFor();
        const allOptions = await settingsModal.getAllOptions();
        settingsModalAssertion.assertValuesAreEqual(allOptions, [
          {
            name: firstAppName,
            version: ExpectedConstants.defaultAppVersion,
          },
        ]);
      },
    );
  },
);
