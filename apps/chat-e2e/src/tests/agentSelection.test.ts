import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest.only(
  'Previously used model is selected for New conversation: change model in "Change agent"\n' +
    'Previously used model is selected for New conversation: change model in My workspace through Use model',
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
  }) => {
    setTestIds('EPMRTC-4878', 'EPMRTC-4880');
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
      2,
    );
    const [firstModel, secondModel] = models;

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
          iconsToBeLoaded: [firstModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(firstModel.name);
      },
    );

    await dialTest.step(
      'Click "Change agent", select the second model',
      async () => {
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(secondModel, marketplacePage);
        await agentInfoAssertion.assertAgentName(secondModel.name);
        const expectedModelIcon = iconApiHelper.getEntityIcon(secondModel);
        await agentInfoAssertion.assertAgentIcon(expectedModelIcon);
      },
    );

    await dialTest.step(
      'Verify recentModelsIds in local storage is unchanged',
      async () => {
        const recentModels = await localStorageManager.getRecentModels();
        expect
          .soft(recentModels, ExpectedMessages.recentEntitiesVisible)
          .toBe(JSON.stringify([firstModel.id, secondModel.id]));
      },
    );

    await dialTest.step(
      'Refresh the page and verify the first model is still selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(firstModel.name);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the first model is still selected',
      async () => {
        await header.createNewConversation();
        await talkToAgentDialog.cancelButton.click();
        await agentInfoAssertion.assertAgentName(firstModel.name);
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
        await marketplace.getAgents().getAgent(secondModel).click();
        await agentDetailsModal.useButton.click();
        const recentModels = await localStorageManager.getRecentModels();
        expect
          .soft(recentModels, ExpectedMessages.recentEntitiesVisible)
          .toBe(JSON.stringify([secondModel.id, firstModel.id])); // secondModel should be first now
      },
    );

    await dialTest.step(
      'Refresh the page and verify the second model is now selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(secondModel.name);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the second model is still selected',
      async () => {
        await header.createNewConversation();
        await talkToAgentDialog.cancelButton.click();
        await agentInfoAssertion.assertAgentName(secondModel.name);
      },
    );
  },
);
