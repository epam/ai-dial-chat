import { Conversation } from '@/chat/types/chat';
import { BackendEntity } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication } from '@/chat/types/publication';
import dialTest from '@/src/core/dialFixtures';
import { API, Attachment, ExpectedConstants } from '@/src/testData';
import { Attributes, Styles, ThemeColorAttributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil, SortingUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';
import { Locator } from '@playwright/test';
import tinycolor from 'tinycolor2';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  '[Select an agent for conversation] Version set on the first screen is shown on the card. Custom application.\n' +
    '[Select an agent for conversation] Custom application ICON and name are shown correctly. Set SVG from Manage attachments.\n' +
    '[Select an agent for conversation] Only short description is shown when short and long are available.\n' +
    '[Select an agent for conversation] Short description on custom app with colour and link.\n' +
    '[Select an agent for conversation] Long custom app name, description are cut with three dots.\n' +
    '[Select an agent for conversation] Topics are shown on the card in the order as selected, not collapsed [+1].\n' +
    '[Select an agent for conversation] Tooltip on hover over the icon is shown.\n' +
    '[Select agent] Context menu is not available for published custom app and for models.\n' +
    '[Select an agent for conversation] Version is shown for agents added through config (models). Expand to see several versions. Select a version from the list.\n' +
    '[Select an agent for conversation] Version. Descending sorting. Custom app.\n' +
    '[Select an agent for conversation] Version set on the first screen is shown on the card. Model.',
  async ({
    dialHomePage,
    talkToAgentDialog,
    talkToAgents,
    talkToAgentDialogAssertion,
    modelApiHelper,
    chat,
    agentInfo,
    agentInfoAssertion,
    setTestIds,
    tooltipAssertion,
    customApplicationBuilder,
    adminApplicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    adminFileApiHelper,
    localStorageManager,
    marketplaceAgentsAssertion,
    agentVersionsDropdownMenuAssertion,
  }) => {
    setTestIds(
      'EPMRTC-1065',
      'EPMRTC-5161',
      'EPMRTC-1061',
      'EPMRTC-1062',
      'EPMRTC-5154',
      'EPMRTC-1063',
      'EPMRTC-1031',
      'EPMRTC-5084',
      'EPMRTC-1037',
      'EPMRTC-5908',
      'EPMRTC-1056',
    );

    const appFirstVersion = GeneratorUtil.randomApplicationVersion();
    const appSecondVersion = GeneratorUtil.randomApplicationVersion([
      appFirstVersion,
    ]);
    const appName = GeneratorUtil.randomApplicationName();
    const shortDescriptionHexColor = '#F76464';
    const expectedRgbColor = tinycolor(shortDescriptionHexColor).toRgbString();
    const expectedTarget = 'target="_blank"';
    const shortDescription = (color: string, target: string) =>
      `abc<i>Short description</i><span style="color:${color};">Red text</span><a href="https://www.epam.com/"${target}>EPAM</a>`;
    const longDescription = GeneratorUtil.randomString(10);
    const appDescription = shortDescription(shortDescriptionHexColor, '')
      .concat('\n\n')
      .concat(longDescription);
    const topics = [
      `b${GeneratorUtil.randomString(5)}`,
      `a${GeneratorUtil.randomString(5)}`,
    ];
    const expectedBgColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.bgAccentPrimaryAlpha,
    );
    let imageUrl: string;
    let agent: DialAIEntityModel;
    let agentElement: BaseElement;
    let actualIcon: Locator;
    let actualNameElement: BaseElement;
    let actualDescriptionElement: BaseElement;
    let firstVersionMenuOptionElement: Locator;

    await dialTest.step('Upload svg image to the root path', async () => {
      imageUrl = await adminFileApiHelper.putFile(Attachment.appIcon);
    });

    await dialTest.step(
      'Create a custom application with two versions, two topics and icon',
      async () => {
        for (const version of [appFirstVersion, appSecondVersion]) {
          const customApplicationModel = customApplicationBuilder
            .withDisplayName(appName)
            .withDisplayVersion(version)
            .withIconUrl(imageUrl)
            .withDescription(appDescription)
            .withDescriptionKeywords(...topics)
            .build();
          const adminApp = await adminApplicationApiHelper.createApplication(
            customApplicationModel,
          );
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withApplicationResource(adminApp, PublishActions.ADD)
            .withFileResource(imageUrl, PublishActions.ADD_IF_ABSENT)
            .build();
          const appPublication =
            await adminPublicationApiHelper.createPublishRequest(
              publishRequest,
            );
          publicationsToUnpublish.push(appPublication);
          await adminPublicationApiHelper.approveRequest(appPublication);
        }
        agent = (await modelApiHelper.getAgentByNameAndVersion({
          name: appName,
          version: appSecondVersion,
        }))!;
        await localStorageManager.setRecentModelsIds(agent);
      },
    );

    await dialTest.step(
      'Open Dial home page, click on "Change agent" button and verify agent with correct application data is selected',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await agentInfoAssertion.assertAgentName(appName);
        await agentInfoAssertion.assertAgentVersion(appSecondVersion);

        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
        await talkToAgentDialogAssertion.assertAgentState(agent, 'visible');
        talkToAgentDialogAssertion.assertValue(
          (await talkToAgents.getAgentNames())[0],
          appName,
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(agent);
        agentElement = talkToAgents.getAgent(agent);
        actualIcon = await talkToAgents.getAgentIcon(agentElement);
        await marketplaceAgentsAssertion.assertEntityIcon(
          actualIcon,
          '/api/' + agent.iconUrl,
        );
        actualNameElement = talkToAgents.getAgentName(agentElement);
        actualDescriptionElement =
          talkToAgents.getAgentDescription(agentElement);
        await marketplaceAgentsAssertion.assertElementText(
          actualNameElement,
          appName,
        );
        await marketplaceAgentsAssertion.assertElementInnerHtml(
          actualDescriptionElement,
          shortDescription(` ${expectedRgbColor}`, ` ${expectedTarget}`),
        );
      },
    );

    await dialTest.step(
      'Verify name, description and version fields text is truncated',
      async () => {
        await talkToAgentDialogAssertion.assertElementTextIsTruncated(
          actualNameElement,
        );
        await talkToAgentDialogAssertion.assertElementTextIsTruncated(
          talkToAgents.getAgentDescriptionContainer(agentElement),
        );
        const actualVersionElement = talkToAgents.getAgentVersion(agentElement);
        await talkToAgentDialogAssertion.assertElementTextIsTruncated(
          actualVersionElement,
        );
      },
    );

    await dialTest.step(
      'Verify colorful topics are displayed in the right order, no hidden topics are available',
      async () => {
        const visibleTopicsElement =
          talkToAgents.getAgentVisibleTopics(agentElement);
        await talkToAgentDialogAssertion.assertElementInnerText(
          visibleTopicsElement,
          topics,
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgents.getAgentHiddenTopics(agentElement),
          'hidden',
        );
        for (
          let i = 1;
          i <= (await visibleTopicsElement.getElementsCount());
          i++
        ) {
          await talkToAgentDialogAssertion.assertElementBorderColors(
            visibleTopicsElement.getNthElement(i),
            ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
          );
        }
      },
    );

    await dialTest.step(
      'Hover over agent icon and verify tooltip is shown, dots menu is not available',
      async () => {
        await actualIcon.hover();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.agentIconTooltip(appName, appSecondVersion),
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgents.getAgentElementDotsMenu(agentElement),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Expand version dropdown menu and verify the sorted list of versions is displayed, selected option is highlighted, option is highlighted on hover over',
      async () => {
        await talkToAgentDialog.getVersionMenuTrigger(agentElement).click();
        const versionsDropdownMenu = talkToAgentDialog.getVersionDropdownMenu();
        const secondVersionMenuOptionElement =
          versionsDropdownMenu.menuOption(appSecondVersion);
        await agentVersionsDropdownMenuAssertion.assertElementBackgroundColors(
          secondVersionMenuOptionElement,
          expectedBgColor,
        );
        await talkToAgentDialogAssertion.assertElementClass(
          talkToAgentDialog.getVersionChevronIcon(agentElement),
          new RegExp(Attributes.rotated180),
        );
        await agentVersionsDropdownMenuAssertion.assertMenuOptions(
          SortingUtil.sortVersionsArray([appSecondVersion, appFirstVersion]),
        );
        firstVersionMenuOptionElement =
          versionsDropdownMenu.menuOption(appFirstVersion);
        await firstVersionMenuOptionElement.hover();
        await agentVersionsDropdownMenuAssertion.assertElementBackgroundColors(
          firstVersionMenuOptionElement,
          expectedBgColor,
        );
      },
    );

    await dialTest.step(
      'Select a new version and verify modal is closed, new version is set on the chat screen',
      async () => {
        await firstVersionMenuOptionElement.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'hidden',
        );
        await agentInfoAssertion.assertAgentVersion(appFirstVersion);
      },
    );

    await dialTest.step(
      'Open version dropdown menu on the new chat screen and select a new one',
      async () => {
        await agentInfo.agentVersionMenuTrigger.click();
        await agentInfo
          .getAgentVersionsDropdownMenu()
          .selectMenuOption(appSecondVersion);
      },
    );

    await dialTest.step(
      'Click on "Change agent" button and verify agent with a new version is selected',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(agent);
        await talkToAgentDialogAssertion.assertAgentState(agent, 'visible');
      },
    );
  },
);

dialTest(
  '[Select an agent for conversation] Default icon is shown for Custom application if the icon field is not set.\n' +
    '[Select an agent for conversation] Version is shown for custom application. When the application is not pre-selected.\n' +
    '[Select an agent for conversation] Topics are collapsed, calculated in [+1], tooltip with topics is shown.\n' +
    '[Select an agent for conversation] Version is shown for custom application. When the application is at the top of recent list (pre-selected already).\n' +
    `[Select an agent for conversation] Three dots menu doesn't exist for models, applications created from config.\n` +
    '[Select an agent for conversation] Version and other items are shown for model when the model was removed from My workspace' +
    '[Select an agent for conversation] Red warning is shown when selected custom app was unpublished',
  async ({
    dialHomePage,
    talkToAgentDialog,
    talkToAgents,
    talkToAgentDialogAssertion,
    modelApiHelper,
    chat,
    topicsTooltip,
    marketplacePage,
    marketplaceHeader,
    marketplaceAgents,
    confirmationDialog,
    marketplaceAgentsSection,
    agentInfoAssertion,
    navigationPanel,
    setTestIds,
    tooltipAssertion,
    customApplicationBuilder,
    adminPublicationApiHelper,
    applicationApiHelper,
    itemApiHelper,
    publicationApiHelper,
    publishRequestBuilder,
    localStorageManager,
    marketplaceAgentsAssertion,
    iconApiHelper,
    conversationData,
    dataInjector,
    conversations,
    chatHeader,
    chatAssertion,
  }) => {
    setTestIds(
      'EPMRTC-5160',
      'EPMRTC-1055',
      'EPMRTC-5541',
      'EPMRTC-5556',
      'EPMRTC-5155',
      'EPMRTC-1054',
      'EPMRTC-4623',
    );

    const appVersion = GeneratorUtil.randomApplicationVersion();
    const appName = GeneratorUtil.randomApplicationName();
    const topics = [
      GeneratorUtil.randomString(15),
      GeneratorUtil.randomString(15),
      GeneratorUtil.randomString(15),
      GeneratorUtil.randomString(15),
      GeneratorUtil.randomString(15),
      GeneratorUtil.randomString(15),
    ];

    let app: BackendEntity;
    let appPublication: Publication;
    let agent: DialAIEntityModel;
    let conversation: Conversation;
    let agentElement: BaseElement;
    let actualVersionElement: BaseElement;
    let hiddenTopicsElement: BaseElement;
    let visibleTopicsCount: number;
    const hiddenTopicsCountRegExp = /\+\d+/;
    let randomModel: DialAIEntityModel | undefined;

    await dialTest.step(
      'Create a custom application with one version and four topics',
      async () => {
        const customApplicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(appVersion)
          .withDescriptionKeywords(...topics)
          .build();
        app = await applicationApiHelper.createApplication(
          customApplicationModel,
        );
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withApplicationResource(app, PublishActions.ADD)
          .build();
        appPublication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(appPublication);

        agent = (await modelApiHelper.getAgentByNameAndVersion({
          name: appName,
          version: appVersion,
        }))!;
      },
    );

    await dialTest.step(
      'Create a conversation with published agent',
      async () => {
        conversation = conversationData.prepareDefaultConversation(agent);
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Set model and application from the config to the recent',
      async () => {
        const configModels = ModelsUtil.getLatestModels();
        randomModel =
          configModels.length !== 0
            ? GeneratorUtil.randomArrayElement(
                configModels.filter((cm) => !cm.description?.includes('<')),
              )
            : undefined;
        if (randomModel !== undefined) {
          await localStorageManager.setRecentModelsIds(randomModel);
        }
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open Dial home page, click on "Change agent" button and verify agent with version and default icon is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
        await talkToAgentDialogAssertion.assertAgentState(agent, 'visible');
        agentElement = talkToAgents.getAgent(agent);
        const actualIcon = await talkToAgents.getAgentIcon(agentElement);
        await marketplaceAgentsAssertion.assertEntityIcon(
          actualIcon,
          API.defaultModelIconHost(),
        );
        actualVersionElement = talkToAgents.getAgentVersion(agentElement);
        await marketplaceAgentsAssertion.assertElementText(
          actualVersionElement,
          appVersion,
        );
      },
    );

    await dialTest.step(
      'Verify topics are displayed in the right order, hidden topics are collapsed',
      async () => {
        hiddenTopicsElement = talkToAgents.getAgentHiddenTopics(agentElement);
        await talkToAgentDialogAssertion.assertElementState(
          hiddenTopicsElement,
          'visible',
        );
        await talkToAgentDialogAssertion.assertElementText(
          hiddenTopicsElement,
          hiddenTopicsCountRegExp,
        );
        const hiddenTopicsCount = await hiddenTopicsElement.getElementContent();
        const visibleTopicsElement =
          talkToAgents.getAgentVisibleTopics(agentElement);
        visibleTopicsCount = await visibleTopicsElement.getElementsCount();
        talkToAgentDialogAssertion.assertValue(
          +hiddenTopicsCount! + visibleTopicsCount,
          topics.length,
        );
        await talkToAgentDialogAssertion.assertElementInnerText(
          visibleTopicsElement,
          topics.slice(0, visibleTopicsCount),
        );
      },
    );

    await dialTest.step(
      'Hover over collapsed icon and verify colorful topics are displayed on the tooltip',
      async () => {
        await hiddenTopicsElement.hoverOver();
        await tooltipAssertion.assertElementState(topicsTooltip, 'visible');
        await tooltipAssertion.assertTooltipContent(
          topics.slice(visibleTopicsCount).join('\n'),
        );
        await tooltipAssertion.assertTooltipStyle(
          Styles.textWrapMode,
          Styles.wrap,
        );
        const tooltipTopicsCount = await topicsTooltip.topic.getElementsCount();
        for (let i = 1; i <= tooltipTopicsCount; i++) {
          await tooltipAssertion.assertElementBorderColors(
            topicsTooltip.topic.getNthElement(i),
            ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
          );
        }
      },
    );

    await dialTest.step(
      'Click on collapsed icon and verify tooltip is closed',
      async () => {
        await hiddenTopicsElement.click();
        await tooltipAssertion.assertElementState(topicsTooltip, 'hidden');
      },
    );

    await dialTest.step(
      'Click on collapsed icon again and verify tooltip is shown',
      async () => {
        await hiddenTopicsElement.click();
        await tooltipAssertion.assertElementState(topicsTooltip, 'visible');
      },
    );

    await dialTest.step(
      'Verify dots menu is not available for the model from the config',
      async () => {
        if (randomModel !== undefined) {
          const configAgentElement = talkToAgents.getAgent(randomModel);
          await configAgentElement.hoverOver();
          await talkToAgentDialogAssertion.assertElementState(
            talkToAgents.getAgentElementDotsMenu(configAgentElement),
            'hidden',
          );
        }
      },
    );

    await dialTest.step(
      'Go to "My Workspace" page, un-bookmark the config model and back to the chat',
      async () => {
        if (randomModel !== undefined) {
          await talkToAgentDialog.goToMyWorkspace();
          await marketplacePage.waitForPageLoaded();
          await marketplaceHeader.searchInput.fillInInput(randomModel.name);
          const randomModelElement =
            await marketplaceAgentsSection.findAgentElement(randomModel, {
              isWorkspaceAgent: true,
              isEditable: false,
            });
          await marketplaceAgents
            .getAgentElementRemoveBookmarkIcon(randomModelElement)
            .click();
          await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
          await navigationPanel.backToChat();
          await agentInfoAssertion.assertAgentName(randomModel.name);
          await agentInfoAssertion.assertAgentVersion(randomModel.version);
        }
      },
    );

    await dialTest.step(
      'Click on "Change agent" button and verify config model with correct data still stays on the first place and selected',
      async () => {
        if (randomModel !== undefined) {
          await chat.changeAgentButton.click();
          await talkToAgentDialogAssertion.assertElementState(
            talkToAgentDialog,
            'visible',
          );
          await talkToAgentDialogAssertion.assertAgentState(
            randomModel,
            'visible',
          );
          const modelElement = talkToAgents.getAgent(randomModel);
          const actualVersionElement =
            talkToAgents.getAgentVersion(modelElement);
          const actualDescrElement =
            talkToAgents.getAgentDescription(modelElement);
          await marketplaceAgentsAssertion.assertElementText(
            talkToAgents.getAgentName(modelElement),
            randomModel.name,
          );
          randomModel.description
            ? await marketplaceAgentsAssertion.assertElementText(
                actualDescrElement,
                randomModel.description.split('\n\n')[0],
              )
            : await marketplaceAgentsAssertion.assertElementState(
                actualDescrElement,
                'hidden',
              );
          randomModel.version
            ? await marketplaceAgentsAssertion.assertElementText(
                actualVersionElement,
                randomModel.version,
              )
            : await marketplaceAgentsAssertion.assertElementState(
                actualVersionElement,
                'hidden',
              );
          const actualTopics = talkToAgents.getAgentVisibleTopics(modelElement);
          randomModel.topics && randomModel.topics.length > 0
            ? marketplaceAgentsAssertion.assertNumberIsGreaterThan(
                await actualTopics.getElementsCount(),
                0,
              )
            : await marketplaceAgentsAssertion.assertElementState(
                actualTopics,
                'hidden',
              );
          const actualIconElement =
            await talkToAgents.getAgentIcon(modelElement);
          const expectedIcon = iconApiHelper.getEntityIcon(randomModel);
          await marketplaceAgentsAssertion.assertEntityIcon(
            actualIconElement,
            expectedIcon,
          );
          await talkToAgentDialogAssertion.assertAgentIsSelected(randomModel);
        }
      },
    );

    await dialTest.step(
      'Go to "My Workspace" page, find created agent and use it',
      async () => {
        await talkToAgentDialog.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appName);
        await marketplaceAgentsSection.findAndUseAgent(agent, {
          isWorkspaceAgent: true,
          isEditable: true,
        });
        await agentInfoAssertion.assertAgentName(appName);
        await agentInfoAssertion.assertAgentVersion(appVersion);
      },
    );

    await dialTest.step(
      'Click on "Change agent" button and verify agent with correct data is selected and stays on the first place',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
        await talkToAgentDialogAssertion.assertAgentState(agent, 'visible');
        const agentElement = talkToAgents.getAgent(agent);
        actualVersionElement = talkToAgents.getAgentVersion(agentElement);
        await marketplaceAgentsAssertion.assertElementText(
          actualVersionElement,
          appVersion,
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(agent);

        const hiddenTopicsElement =
          talkToAgents.getAgentHiddenTopics(agentElement);
        await talkToAgentDialogAssertion.assertElementState(
          hiddenTopicsElement,
          'visible',
        );
        await talkToAgentDialogAssertion.assertElementText(
          hiddenTopicsElement,
          hiddenTopicsCountRegExp,
        );
        const hiddenTopicsCount = await hiddenTopicsElement.getElementContent();
        const visibleTopicsElement =
          talkToAgents.getAgentVisibleTopics(agentElement);
        visibleTopicsCount = await visibleTopicsElement.getElementsCount();
        talkToAgentDialogAssertion.assertValue(
          +hiddenTopicsCount! + visibleTopicsCount,
          topics.length,
        );
        await talkToAgentDialogAssertion.assertElementInnerText(
          visibleTopicsElement,
          topics.slice(0, visibleTopicsCount),
        );
        await talkToAgentDialog.cancelButton.click();
      },
    );

    await dialTest.step('Unpublish created agent', async () => {
      const unpublishResponse =
        await adminPublicationApiHelper.createUnpublishRequest(appPublication);
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
      await itemApiHelper.deleteBackendItem(app);
    });

    await dialTest.step(
      'Refresh the page, select conversation with the agent and verify red label is displayed instead of send input',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatAssertion.assertNotAllowedModelLabelContent();
      },
    );

    await dialTest.step(
      'Click on "Change agent" in the header and verify the agent is selected, agent reference and red warning are displayed instead',
      async () => {
        await chatHeader.chatModelIcon.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
        const notAvailableAgentElement =
          talkToAgents.getNotAvailableAgentElement(agent.reference);
        await talkToAgentDialogAssertion.assertElementText(
          talkToAgents.getAgentDescription(notAvailableAgentElement),
          ExpectedConstants.notAllowedModelError,
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgents.getAgentVersion(notAvailableAgentElement),
          'hidden',
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgents.getAgentTopicsContainer(notAvailableAgentElement),
          'hidden',
        );
        talkToAgentDialogAssertion.assertValue(
          (await talkToAgents.getAgentNames())[0],
          agent.reference,
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(agent.reference);
      },
    );
  },
);
