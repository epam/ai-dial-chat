import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { Conversation } from '@/chat/types/chat';
import { BackendEntity, EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication } from '@/chat/types/publication';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import {
  Attributes,
  StyleValues,
  Styles,
  ThemeColorAttributes,
} from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil, SortingUtil } from '@/src/utils';
import { CustomAppAttributes } from '@/src/utils/customApplicationPublishingUtil';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';
import { Locator, expect } from '@playwright/test';
import tinycolor from 'tinycolor2';

dialTest(
  '[Select an agent for conversation] Version set on the first screen is shown on the card. Custom application.\n' +
    '[Select an agent for conversation] Custom application ICON and name are shown correctly. Set SVG from Manage attachments.\n' +
    '[Select an agent for conversation] Only short description is shown when short and long are available.\n' +
    '[Select an agent for conversation] Short description on custom app with colour and link.\n' +
    '[Select an agent for conversation] Long custom app name, description are cut with three dots.\n' +
    '[Select an agent for conversation] Topics are shown on the card in the order as selected, not collapsed [+1].\n' +
    '[Select an agent for conversation] Tooltip on the icon is not shown.\n' +
    '[Select an agent for conversation] Tooltip appears on long name only.\n' +
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
    tooltip,
    customApplicationBuilder,
    adminApplicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    adminFileApiHelper,
    localStorageManager,
    entityVersionsDropdownMenuAssertion,
  }) => {
    setTestIds(
      'EPMDIAL-5841',
      'EPMDIAL-5829',
      'EPMDIAL-5833',
      'EPMDIAL-5834',
      'EPMDIAL-5848',
      'EPMDIAL-5835',
      'EPMDIAL-5831',
      'EPMDIAL-5849',
      'EPMDIAL-5871',
      'EPMDIAL-5839',
      'EPMDIAL-5844',
      'EPMDIAL-5840',
    );

    const appFirstVersion = GeneratorUtil.randomEntityVersion();
    const appSecondVersion = GeneratorUtil.randomEntityVersion([
      appFirstVersion,
    ]);
    const appName = GeneratorUtil.randomApplicationName();
    const shortDescriptionHexColor = '#F76464';
    const expectedRgbColor = tinycolor(shortDescriptionHexColor).toRgbString();
    const expectedTarget = 'target="_blank"';
    const expectedRel = 'rel="noopener noreferrer"';
    const shortDescription = (color: string, target: string, rel = '') =>
      `abc<i>Short description</i><span style="color:${color};">Red text</span><a href="https://www.epam.com/"${rel}${target}>EPAM</a>`;
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
    let actualVersionElement: BaseElement;

    await dialTest.step('Upload svg image to the root path', async () => {
      imageUrl = await adminFileApiHelper.putFile(Attachment.appIconSvg);
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
          await adminPublicationApiHelper.approveRequest(appPublication);
        }
        agent = (await modelApiHelper.getAgentByNameAndVersion({
          name: appName,
          version: appSecondVersion,
        }))!;
        await localStorageManager.setRecentModelsIdsAndUseLastModel(agent);
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
          (await talkToAgents.getEntityNames())[0],
          appName,
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(agent);
        agentElement = talkToAgents.getEntity(agent);
        actualIcon = await talkToAgents.getEntityIcon(agentElement);
        await talkToAgentDialogAssertion.assertEntityIcon(
          actualIcon,
          '/api/' + agent.iconUrl,
        );
        actualNameElement = talkToAgents.getEntityName(agentElement);
        actualDescriptionElement =
          talkToAgents.getEntityDescription(agentElement);
        actualVersionElement = talkToAgents.getEntityVersion(agentElement);
        await talkToAgentDialogAssertion.assertElementText(
          actualNameElement,
          appName,
        );
        await talkToAgentDialogAssertion.assertElementInnerHtml(
          actualDescriptionElement,
          shortDescription(
            ` ${expectedRgbColor}`,
            ` ${expectedTarget}`,
            ` ${expectedRel}`,
          ),
        );
        await talkToAgentDialogAssertion.assertElementText(
          actualVersionElement,
          appSecondVersion,
        );
      },
    );

    await dialTest.step(
      'Verify name, description and version fields text is truncated',
      async () => {
        await talkToAgentDialogAssertion.assertElementTextIsTruncated(
          actualNameElement,
        );
        await talkToAgentDialogAssertion.assertElementMultilineTextIsTruncated(
          talkToAgents.getEntityDescriptionContainer(agentElement),
          2,
        );
        actualVersionElement = talkToAgents.getEntityVersion(agentElement);
        await talkToAgentDialogAssertion.assertElementTextIsTruncated(
          actualVersionElement,
        );
      },
    );

    await dialTest.step(
      'Verify colorful topics are displayed in the right order, no hidden topics are available',
      async () => {
        const visibleTopicsElement =
          talkToAgents.getEntityVisibleTopics(agentElement);
        await talkToAgentDialogAssertion.assertElementInnerText(
          visibleTopicsElement,
          topics,
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgents.getEntityHiddenTopics(agentElement),
          'hidden',
        );
        for (
          let i = 1;
          i <= (await visibleTopicsElement.getElementsCount());
          i++
        ) {
          await talkToAgentDialogAssertion.assertElementBorderColors(
            visibleTopicsElement.getNthElement(i),
            ThemesUtil.getRgbColorByKey(ThemeColorAttributes.controlsBgAccent),
          );
        }
      },
    );

    await dialTest.step(
      'Hover over agent icon and name and verify tooltip is not shown, dots menu is not available',
      async () => {
        await actualIcon.hover();
        await talkToAgentDialogAssertion.assertElementState(tooltip, 'hidden');
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgents.getEntityElementDotsMenu(agentElement),
          'hidden',
        );
        await actualNameElement.hoverOver();
        await talkToAgentDialogAssertion.assertElementState(tooltip, 'hidden');
      },
    );

    await dialTest.step(
      'Expand version dropdown menu and verify the sorted list of versions is displayed, selected option is highlighted, option is highlighted on hover over',
      async () => {
        await talkToAgentDialog.getVersionMenuTrigger(agentElement).click();
        const versionsDropdownMenu = talkToAgentDialog.getVersionDropdownMenu();
        const secondVersionMenuOptionElement =
          versionsDropdownMenu.menuOption(appSecondVersion);
        await entityVersionsDropdownMenuAssertion.assertElementBackgroundColors(
          secondVersionMenuOptionElement,
          expectedBgColor,
        );
        await talkToAgentDialogAssertion.assertElementClass(
          talkToAgentDialog.getVersionChevronIcon(agentElement),
          new RegExp(Attributes.rotated180),
        );
        await entityVersionsDropdownMenuAssertion.assertMenuOptions(
          SortingUtil.sortVersionsArray([appSecondVersion, appFirstVersion]),
        );
        firstVersionMenuOptionElement =
          versionsDropdownMenu.menuOption(appFirstVersion);
        await firstVersionMenuOptionElement.hover();
        await entityVersionsDropdownMenuAssertion.assertElementBackgroundColors(
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
    '[Select an agent for conversation] Red warning is shown when selected custom app was unpublished.\n' +
    `[First screen] 'Not available agent selected' error instead of input message field, on Select an agent for conversation, on Settings`,
  async ({
    dialHomePage,
    talkToAgentDialog,
    talkToAgents,
    talkToAgentDialogAssertion,
    modelApiHelper,
    chat,
    conversationSettingsModal,
    agentSettings,
    agentSettingAssertion,
    topicsTooltip,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntities,
    confirmationDialog,
    marketplaceEntitiesSection,
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
    iconApiHelper,
    conversationData,
    dataInjector,
    conversations,
    chatHeader,
    chatAssertion,
    sendMessage,
    sendMessageAssertion,
  }) => {
    setTestIds(
      'EPMDIAL-5830',
      'EPMDIAL-5843',
      'EPMDIAL-5836',
      'EPMDIAL-5842',
      'EPMDIAL-5832',
      'EPMDIAL-5846',
      'EPMDIAL-5847',
      'EPMDIAL-5747',
    );

    const appVersion = GeneratorUtil.randomEntityVersion();
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
    let searchInput: BaseElement;

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
        const configModelsWithSimpleDescr =
          ModelsUtil.getAgentsWithSimpleDescription(
            ModelsUtil.getLatestModels(),
          );
        configModelsWithSimpleDescr.length !== 0
          ? GeneratorUtil.randomArrayElement(configModelsWithSimpleDescr)
          : undefined;
        if (randomModel !== undefined) {
          await localStorageManager.setRecentModelsIdsAndUseLastModel(
            randomModel,
          );
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
        agentElement = talkToAgents.getEntity(agent);
        const actualIcon = await talkToAgents.getEntityIcon(agentElement);
        await talkToAgentDialogAssertion.assertEntityIcon(
          actualIcon,
          API.defaultModelIconHost(),
        );
        actualVersionElement = talkToAgents.getEntityVersion(agentElement);
        await talkToAgentDialogAssertion.assertElementText(
          actualVersionElement,
          appVersion,
        );
      },
    );

    await dialTest.step(
      'Verify topics are displayed in the right order, hidden topics are collapsed',
      async () => {
        hiddenTopicsElement = talkToAgents.getEntityHiddenTopics(agentElement);
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
          talkToAgents.getEntityVisibleTopics(agentElement);
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
      'Click on collapsed icon and verify colorful topics are displayed on the tooltip',
      async () => {
        await hiddenTopicsElement.click();
        await tooltipAssertion.assertElementState(topicsTooltip, 'visible');
        await tooltipAssertion.assertTooltipContent(
          topics.slice(visibleTopicsCount).join('\n'),
        );
        await tooltipAssertion.assertTooltipStyle(
          Styles.textWrapMode,
          StyleValues.wrap,
        );
        const tooltipTopicsCount = await topicsTooltip.topic.getElementsCount();
        for (let i = 1; i <= tooltipTopicsCount; i++) {
          await tooltipAssertion.assertElementBorderColors(
            topicsTooltip.topic.getNthElement(i),
            ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgAccentPrimary),
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
          const configAgentElement = talkToAgents.getEntity(randomModel);
          await configAgentElement.hoverOver();
          await talkToAgentDialogAssertion.assertElementState(
            talkToAgents.getEntityElementDotsMenu(configAgentElement),
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
          searchInput = marketplaceHeader.getSearch().inputField;
          await searchInput.fillInInput(randomModel.name);
          const randomModelElement =
            await marketplaceEntitiesSection.findEntityElement(randomModel, {
              isWorkspaceEntity: true,
              isEditable: false,
            });
          await marketplaceEntities
            .getEntityElementRemoveBookmarkIcon(randomModelElement)
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
          const modelElement = talkToAgents.getEntity(randomModel);
          const actualVersionElement =
            talkToAgents.getEntityVersion(modelElement);
          const actualDescrElement =
            talkToAgents.getEntityDescription(modelElement);
          await talkToAgentDialogAssertion.assertElementText(
            talkToAgents.getEntityName(modelElement),
            randomModel.name,
          );
          randomModel.description
            ? await talkToAgentDialogAssertion.assertElementText(
                actualDescrElement,
                randomModel.description.split('\n\n')[0],
              )
            : await talkToAgentDialogAssertion.assertElementState(
                actualDescrElement,
                'hidden',
              );
          randomModel.version
            ? await talkToAgentDialogAssertion.assertElementText(
                actualVersionElement,
                randomModel.version,
              )
            : await talkToAgentDialogAssertion.assertElementState(
                actualVersionElement,
                'hidden',
              );
          const actualTopics =
            talkToAgents.getEntityVisibleTopics(modelElement);
          randomModel.topics && randomModel.topics.length > 0
            ? talkToAgentDialogAssertion.assertNumberIsGreaterThan(
                await actualTopics.getElementsCount(),
                0,
              )
            : await talkToAgentDialogAssertion.assertElementState(
                actualTopics,
                'hidden',
              );
          const actualIconElement =
            await talkToAgents.getEntityIcon(modelElement);
          const expectedIcon = iconApiHelper.getEntityIcon(randomModel);
          await talkToAgentDialogAssertion.assertEntityIcon(
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
        await marketplaceHeader.getSearch().inputField.fillInInput(appName);
        await marketplaceEntitiesSection.findAndUseAgent(agent, {
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
        const agentElement = talkToAgents.getEntity(agent);
        actualVersionElement = talkToAgents.getEntityVersion(agentElement);
        await talkToAgentDialogAssertion.assertElementText(
          actualVersionElement,
          appVersion,
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(agent);

        const hiddenTopicsElement =
          talkToAgents.getEntityHiddenTopics(agentElement);
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
          talkToAgents.getEntityVisibleTopics(agentElement);
        visibleTopicsCount = await visibleTopicsElement.getElementsCount();
        talkToAgentDialogAssertion.assertValue(
          +hiddenTopicsCount! + visibleTopicsCount,
          topics.length,
        );
        await talkToAgentDialogAssertion.assertElementInnerText(
          visibleTopicsElement,
          topics.slice(0, visibleTopicsCount),
        );
        await talkToAgentDialog.getCloseButton().click();
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
        await chatAssertion.assertNotAllowedModelLabelContent(
          conversation.model.id,
        );
        await sendMessageAssertion.assertElementState(
          sendMessage.messageInput,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Hover over "change the agent" button and verify it does not change the color',
      async () => {
        await chat.changeNotAvailableAgentButton.hoverOver();
        await chatAssertion.assertElementColor(
          chat.changeNotAvailableAgentButton,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textPrimary),
        );
      },
    );

    await dialTest.step(
      'Click on "Configure settings" button and verify "Agent is not available" label is displayed',
      async () => {
        await chatHeader.conversationSettings.click();
        await agentSettingAssertion.assertElementText(
          agentSettings,
          ExpectedConstants.agentIsNotAvailableLabel,
        );
        await conversationSettingsModal.cancelButton.click();
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
          talkToAgents.getNotAvailableEntityElement(agent.reference);
        const errorDescriptionElement = talkToAgents.getEntityDescription(
          notAvailableAgentElement,
        );
        await talkToAgentDialogAssertion.assertElementText(
          errorDescriptionElement,
          ExpectedConstants.notAllowedModelError,
        );
        const expectedColor = ThemesUtil.getRgbColorByKey(
          ThemeColorAttributes.textError,
        );
        await talkToAgentDialogAssertion.assertElementColor(
          errorDescriptionElement,
          expectedColor,
        );
        await talkToAgentDialogAssertion.assertElementBorderColors(
          notAvailableAgentElement,
          expectedColor,
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgents.getEntityVersion(notAvailableAgentElement),
          'hidden',
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgents.getEntityTopicsContainer(notAvailableAgentElement),
          'hidden',
        );
        talkToAgentDialogAssertion.assertValue(
          (await talkToAgents.getEntityNames())[0],
          agent.reference,
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(agent.reference);
      },
    );
  },
);

dialTest(
  '[Select an agent for conversation] Red error appears if the custom app is deleted thru the menu.\n' +
    `[Select an agent for conversation] 'All agents' tab contains 'not existed' card.\n` +
    `[Select an agent for conversation] 'Go to My workspace' link on 'My agents' is changed to 'Go to DIAL Marketplace' on 'All agents' tab.\n` +
    `[Select an agent for conversation] 'All agents' tab contains al the cards from DIAL Marketplace with the same sorting order and grouping.\n` +
    `[Select an agent for conversation] 'All agents' tab doesn't contain 'Replay as is' card.\n` +
    `[Select an agent for conversation] 'All agents' tab doesn't contain 'Playback' card.\n` +
    `[Select an agent for conversation] Version is shown on the card on 'All agents' tab if the agent is NOT added to My workspace.\n` +
    `[Select an agent for conversation] Version is shown on the card on 'All agents' tab if the agent is added to My workspace.\n` +
    `[Select an agent for conversation] 'DIAL Marketplace' is opened if to click on 'Go to DIAL Marketplace' from 'Select an agent for conversation' window on 'All agents' tab`,
  async ({
    dialHomePage,
    talkToAgentDialog,
    fileApiHelper,
    talkToAgents,
    talkToAgentDialogAssertion,
    chat,
    confirmationDialog,
    setTestIds,
    customApplicationBuilder,
    applicationApiHelper,
    localStorageManager,
    chatHeader,
    marketplacePage,
    baseAssertion,
    navigationPanel,
    page,
    modelApiHelper,
  }) => {
    setTestIds(
      'EPMDIAL-5855',
      'EPMDIAL-5862',
      'EPMDIAL-5867',
      'EPMDIAL-5859',
      'EPMDIAL-5860',
      'EPMDIAL-5861',
      'EPMDIAL-5864',
      'EPMDIAL-5865',
      'EPMDIAL-5866',
    );

    let appModel: ApiApplicationModelRegular;
    let appElement: BaseElement;
    let actualAgentNames: string[];
    let allConfigAgents: DialAIEntityModel[];
    let randomWorkspaceAgent: DialAIEntityModel;

    await dialTest.step(
      'Create a custom application by main user',
      async () => {
        appModel = customApplicationBuilder.build();
        await applicationApiHelper.createApplication(appModel);
      },
    );

    await dialTest.step(
      'Set custom app agent and one more random config agent to the recent',
      async () => {
        allConfigAgents = await modelApiHelper.getModels();
        //exclude Application type agents from verification since the list of applications is changeable
        randomWorkspaceAgent = GeneratorUtil.randomArrayElement(
          allConfigAgents.filter(
            (a) => a.type !== EntityType.Application && a.version !== undefined,
          ),
        );
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          appModel.reference!,
          randomWorkspaceAgent.reference,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Create conversation with app and open "Select an agent for conversation" modal',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('test');
        await chatHeader.chatModelIcon.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Remove the custom app card from the list and verify error message is displayed on the card',
      async () => {
        appElement = talkToAgents.getEntity(appModel.display_name);
        await appElement.hoverOver();
        const appDotsMenuElement =
          talkToAgents.getEntityElementDotsMenu(appElement);
        await appDotsMenuElement.click();
        const appDropdownMenu = talkToAgents.getEntityDropdownMenu();
        await appDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
        const notAvailableAgentElement =
          talkToAgents.getNotAvailableEntityElement(appModel.reference!);
        await talkToAgentDialogAssertion.assertElementText(
          talkToAgents.getEntityDescription(notAvailableAgentElement),
          ExpectedConstants.notAllowedModelError,
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgents.getEntityVersion(notAvailableAgentElement),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Switch to "All agents" tab and verify removed agent stays first, only "Go to DIAL Marketplace" link is available',
      async () => {
        await talkToAgentDialog.allAgentsTab.click();
        const actualVisibleAgentNames = await talkToAgentDialog
          .getAgents()
          .getEntityNames();
        talkToAgentDialogAssertion.assertValue(
          actualVisibleAgentNames[0],
          appModel.reference!,
          ExpectedMessages.elementIsVisible,
        );
        const notAvailableAgentElement =
          talkToAgents.getNotAvailableEntityElement(appModel.reference!);
        await talkToAgentDialogAssertion.assertElementText(
          talkToAgents.getEntityDescription(notAvailableAgentElement),
          ExpectedConstants.notAllowedModelError,
        );
        const goToDialMarketplaceBtn =
          talkToAgentDialog.goToDialMarketplaceButton;
        await talkToAgentDialogAssertion.assertElementState(
          goToDialMarketplaceBtn,
          'visible',
        );
        await talkToAgentDialogAssertion.assertElementText(
          goToDialMarketplaceBtn,
          ExpectedConstants.goToDialMarketplaceButtonLabel,
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog.goToMyWorkspaceButton,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify all available agents are displayed in ascending order',
      async () => {
        actualAgentNames = await talkToAgentDialog.getAllAgentNames();
        actualAgentNames = actualAgentNames.slice(1);
        const groupedConfigAgents = ModelsUtil.groupEntitiesByName(
          allConfigAgents.filter((a) => a.type !== EntityType.Application),
        );
        for (const expectedAgentName of Array.from(
          groupedConfigAgents.keys(),
        )) {
          expect
            .soft(
              actualAgentNames.find((agent) => agent === expectedAgentName),
              ExpectedMessages.agentNameIsValid,
            )
            .toBeDefined();
        }
        talkToAgentDialogAssertion.assertStringsSorting(
          actualAgentNames,
          'asc',
        );
      },
    );

    await dialTest.step(
      'Verify "Replay as is", "Playback" agents are not listed',
      async () => {
        talkToAgentDialogAssertion.assertArrayExcludesAll(
          actualAgentNames,
          [ExpectedConstants.replayAsIsLabel, ExpectedConstants.playbackLabel],
          ExpectedMessages.allAgentsListIsValid,
        );
      },
    );

    await dialTest.step(
      'Verify all the installed and Marketplace agents are listed and versions are displayed on the cards',
      async () => {
        const installedDeploymentsResponse = await fileApiHelper.getFile(
          API.installedDeploymentsHost(),
        );
        const installedDeployments =
          (await installedDeploymentsResponse.json()) as { id: string }[];
        //get a random agent with version not included into "My workspace"
        const marketplaceAgents = allConfigAgents.filter(
          (a) =>
            !installedDeployments.some((d) => d.id === a.reference) &&
            a.type !== EntityType.Application &&
            a.version !== undefined,
        );
        const randomMarketplaceAgent =
          GeneratorUtil.randomArrayElement(marketplaceAgents);

        for (const agent of [randomMarketplaceAgent, randomWorkspaceAgent]) {
          const randomAgentElement = await talkToAgentDialog.findAgent(agent);
          await talkToAgentDialogAssertion.assertElementState(
            randomAgentElement!,
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Switch to "My agents" tab and verify only "Go to My Workspace" link is available',
      async () => {
        await talkToAgentDialog.myAgentsTab.click();
        const goToMyWorkspaceBtn = talkToAgentDialog.goToMyWorkspaceButton;
        await talkToAgentDialogAssertion.assertElementState(
          goToMyWorkspaceBtn,
          'visible',
        );
        await talkToAgentDialogAssertion.assertElementText(
          goToMyWorkspaceBtn,
          ExpectedConstants.goToMyWorkspaceButtonLabel,
        );
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog.goToDialMarketplaceButton,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Switch to "All agents" tab and verify "Go to DIAL Marketplace" link leads to the corresponding page',
      async () => {
        await talkToAgentDialog.allAgentsTab.click();
        await talkToAgentDialog.goToDialMarketplace();
        await marketplacePage.waitForPageLoaded();
        baseAssertion.assertBooleanCondition(
          page.url().includes(ExpectedConstants.workspaceTab),
          false,
          'Page url is valid',
        );
        await baseAssertion.assertElementAttribute(
          navigationPanel.marketplaceHomeButton,
          Attributes.ariaSelected,
          'true',
        );
      },
    );
  },
);

dialTest(
  `[Select an agent for conversation] An agent is added to 'My workspace' if to click on it from 'All agents'.\n` +
    `[Select an agent for conversation] An agent is added to 'My workspace' if to select a version on the card on 'All agents'`,
  async ({
    dialHomePage,
    talkToAgentDialog,
    agentInfoAssertion,
    talkToAgentDialogAssertion,
    chat,
    marketplaceEntitiesSection,
    baseAssertion,
    setTestIds,
    marketplaceEntities,
    entityDetailsModal,
    entityVersionsDropdownMenuAssertion,
    marketplacePage,
    navigationPanel,
    modelApiHelper,
    adminCustomApplicationPublishingUtil,
  }) => {
    setTestIds('EPMDIAL-5868', 'EPMDIAL-5869');

    let firstApp: CustomAppAttributes;
    let secondAppFirstVersion: CustomAppAttributes;
    let secondAppSecondVersion: CustomAppAttributes;
    let firstConfigApp: DialAIEntityModel;
    let secondConfigAppMinorV: DialAIEntityModel;
    let secondConfigAppMajorV: DialAIEntityModel;
    let sortedVersions: string[];
    const expectedBorderColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textAccentPrimary,
    );

    await dialTest.step(
      'Publish two custom applications by admin user, the second one has two versions',
      async () => {
        firstApp =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion();

        const secondAppName = GeneratorUtil.randomApplicationName();
        secondAppFirstVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            { appName: secondAppName },
          );
        secondAppSecondVersion =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion(
            { appName: secondAppName },
          );
        sortedVersions = SortingUtil.sortVersionsArray([
          secondAppFirstVersion.version!,
          secondAppSecondVersion.version!,
        ]);

        const configAgents = await modelApiHelper.getModels();
        firstConfigApp = await modelApiHelper.getAgentByNameAndVersion(
          { name: firstApp.name, version: firstApp.version },
          configAgents,
        );
        secondConfigAppMinorV = await modelApiHelper.getAgentByNameAndVersion(
          { name: secondAppName, version: sortedVersions[1] },
          configAgents,
        );
        secondConfigAppMajorV = await modelApiHelper.getAgentByNameAndVersion(
          { name: secondAppName, version: sortedVersions[0] },
          configAgents,
        );
      },
    );

    await dialTest.step(
      'Open "Select an agent for conversation" modal and switch to "All agents" tab',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
        await talkToAgentDialog.allAgentsTab.click();
      },
    );

    await dialTest.step(
      'Click on the agent with unique version and verify "Select an agent for conversation" modal is closed, the agent is used for the conversation',
      async () => {
        await talkToAgentDialog.useAgent(firstConfigApp, {
          isHttpMethodTriggered: true,
          triggeredHttpMethod: 'PUT',
        });
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'hidden',
        );
        await agentInfoAssertion.assertAgentName(firstConfigApp.name);
        await agentInfoAssertion.assertAgentVersion(firstConfigApp.version);
      },
    );

    await dialTest.step(
      'Click on "Change agent" and verify selected agent stays on the top and highlighted',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(
          firstConfigApp.name,
        );
        const recentTalkTo = await talkToAgentDialog.getAllAgentNames();
        talkToAgentDialogAssertion.assertValue(
          recentTalkTo[0],
          firstConfigApp.name,
          ExpectedMessages.recentEntitiesIsOnTop,
        );
        await talkToAgentDialogAssertion.assertElementBorderColors(
          talkToAgentDialog.getTalkToAgent(firstConfigApp),
          expectedBorderColor,
        );
      },
    );

    await dialTest.step(
      'Click on "Go to My workspace" link and verify the agent is bookmarked',
      async () => {
        await talkToAgentDialog.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        const agentElement = await marketplaceEntitiesSection.findEntityElement(
          firstConfigApp,
          { isWorkspaceEntity: true, isEditable: false },
        );
        await talkToAgentDialogAssertion.assertElementState(
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(agentElement),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Back to the chat, open "Select an agent for conversation" modal and switch to "All agents" tab',
      async () => {
        await navigationPanel.backToChat({ isHttpMethodTriggered: true });
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
        await talkToAgentDialog.allAgentsTab.click();
      },
    );

    await dialTest.step(
      'Select not latest second app version and verify "Select an agent for conversation" modal is closed, the agent is used for the conversation',
      async () => {
        await talkToAgentDialog.useAgent(secondConfigAppMinorV, {
          isHttpMethodTriggered: true,
          triggeredHttpMethod: 'PUT',
        });
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'hidden',
        );
        await agentInfoAssertion.assertAgentName(secondConfigAppMinorV.name);
        await agentInfoAssertion.assertAgentVersion(
          secondConfigAppMinorV.version,
        );
      },
    );

    await dialTest.step(
      'Click on "Change agent" and verify selected agent stays on the top and highlighted',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog,
          'visible',
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(
          secondConfigAppMinorV.name,
        );
        const recentTalkTo = await talkToAgentDialog.getAllAgentNames();
        talkToAgentDialogAssertion.assertValue(
          recentTalkTo[0],
          secondConfigAppMinorV.name,
          ExpectedMessages.recentEntitiesIsOnTop,
        );
        await talkToAgentDialogAssertion.assertElementBorderColors(
          talkToAgentDialog.getTalkToAgent(secondConfigAppMinorV),
          expectedBorderColor,
        );
      },
    );

    await dialTest.step(
      'Click on "Go to My workspace" link and verify all agent versions are bookmarked',
      async () => {
        await talkToAgentDialog.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        const agentElement = await marketplaceEntitiesSection.findEntityElement(
          secondConfigAppMajorV,
          { isWorkspaceEntity: true, isEditable: false },
        );
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityElementRemoveBookmarkIcon(agentElement),
          'visible',
        );

        await agentElement.click();
        await entityDetailsModal.versionMenuTrigger.click();
        await entityVersionsDropdownMenuAssertion.assertMenuOptions(
          sortedVersions,
        );
      },
    );
  },
);
