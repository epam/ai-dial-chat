import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest.only(
  'Previously used model is selected for New conversation: change model in "Change agent"',
  async ({
           dialHomePage,
           chat,
           talkToAgentDialog,
           marketplacePage,
           agentInfoAssertion,
           setTestIds,
           localStorageManager,
           header,
         }) => {
    setTestIds('EPMRTC-4878');
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

    await dialTest.step('Open Dial and verify the first model is selected', async () => {
      await dialHomePage.openHomePage({
        iconsToBeLoaded: [firstModel.iconUrl],
      });
      await dialHomePage.waitForPageLoaded();
      await agentInfoAssertion.assertAgentName(firstModel.name);
    });

    await dialTest.step(
      'Click "Change agent", select the second model',
      async () => {
        await chat.changeAgentButton.waitForState();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(secondModel, marketplacePage);
        await agentInfoAssertion.assertAgentName(secondModel.name);
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
  },
);
