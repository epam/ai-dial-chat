import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest.only(
  'Previously used model is selected for New conversation: change model in "Change agent"\n' +
    'Previously used model is selected for New conversation: change model in My workspace through Use model\n' +
    'RecentModelIds[0] is updated if remove latest used model from My applications',
  async ({
    dialHomePage,
    header,
    chat,
    talkToAgentDialog,
    marketplacePage,
    agentInfoAssertion,
    setTestIds,
    localStorageManager,
    iconApiHelper,
    marketplace,
    agentDetailsModal,
    chatBar,
    confirmationDialog,
    talkToAgentDialogAssertion,
  }) => {
    setTestIds('EPMRTC-4878', 'EPMRTC-4880', 'EPMRTC-4356');
    let models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
      2,
    );
    const [initialModel1, initialModel2] = models;
    const availableModels = ModelsUtil.getLatestModels().filter(
      (m) => m.id !== initialModel1.id && m.id !== initialModel2.id,
    );
    let addedModel = GeneratorUtil.randomArrayElement(availableModels);

    await dialTest.step(
      'Prepare models and set recent models in local storage',
      async () => {
        await localStorageManager.setRecentModelsIdsOnce(...models);
      },
    );

    await dialTest.step(
      'Open Dial and verify the first model is selected',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [initialModel1.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Click "Change agent", select the second model',
      async () => {
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(initialModel2, marketplacePage);
        await agentInfoAssertion.assertAgentName(initialModel2.name);
        const expectedModelIcon = iconApiHelper.getEntityIcon(initialModel2);
        await agentInfoAssertion.assertAgentIcon(expectedModelIcon);
      },
    );

    await dialTest.step(
      'Verify recentModelsIds in local storage is unchanged',
      async () => {
        const recentModels = await localStorageManager.getRecentModels();
        expect
          .soft(recentModels, ExpectedMessages.recentEntitiesVisible)
          .toBe(JSON.stringify([initialModel1.id, initialModel2.id]));
      },
    );

    await dialTest.step(
      'Refresh the page and verify the first model is still selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the first model is still selected',
      async () => {
        await header.createNewConversation();
        await talkToAgentDialog.cancelButton.click();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Click "New conversation", then "Change agent", then "Go to My workspace"',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialog.goToMyWorkspace();
      },
    );

    await dialTest.step(
      'Click "Use model" for the second model and verify recentModelsIds is updated',
      async () => {
        await marketplace.getAgents().getAgent(initialModel2).click();
        await agentDetailsModal.useButton.click();
        const recentModels = await localStorageManager.getRecentModels();
        expect
          .soft(recentModels, ExpectedMessages.recentEntitiesVisible)
          .toBe(JSON.stringify([initialModel2.id, initialModel1.id])); // secondModel should be first now
      },
    );

    await dialTest.step(
      'Refresh the page and verify the second model is now selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the second model is still selected',
      async () => {
        await header.createNewConversation();
        await talkToAgentDialog.cancelButton.click();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );

    await dialTest.step(
      'Click on "DIAL Marketplace", select a new model, and click "Use model"',
      async () => {
        await chatBar.dialMarketplaceLink.click();
        await marketplace.getAgents().getAgent(addedModel).click();
        await agentDetailsModal.useButton.click();
        const recentModels = await localStorageManager.getRecentModels();
        expect
          .soft(recentModels, ExpectedMessages.recentEntitiesVisible)
          .toBe(
            JSON.stringify([addedModel.id, initialModel2.id, initialModel1.id]),
          );
      },
    );

    await dialTest.step(
      'Click "Change agent" and "Go to My workspace", remove the third model, and go back to chat',
      async () => {
        await chatBar.dialMarketplaceLink.click();
        await marketplace.getAgents().getAgent(addedModel).click();
        await agentDetailsModal.filledBookmarkIcon.click();
        await confirmationDialog.confirm();
        await header.backToChatButton.click();
      },
    );

    await dialTest.step(
      'Verify recentModelsIds is updated and the second model is now first',
      async () => {
        const recentModels = await localStorageManager.getRecentModels();
        expect
          .soft(recentModels, ExpectedMessages.recentEntitiesVisible)
          .toBe(JSON.stringify([initialModel2.id, initialModel1.id]));
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the second model is still selected',
      async () => {
        await header.createNewConversation();
        await talkToAgentDialogAssertion.assertAgentIsSelected(initialModel2);
        await talkToAgentDialog.cancelButton.click();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );
  },
);
