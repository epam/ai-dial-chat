import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { allure } from 'allure-playwright';

dialTest(
  'New conversation stays on Back to Chat if new conversation was on the screen',
  async ({
    dialHomePage,
    header,
    chat,
    agentInfoAssertion,
    talkToAgentDialog,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-4587');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();

    // 1. Open the home page and set a random model to recent
    const randomModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getModels(),
    );
    await localStorageManager.setRecentModelsIdsOnce(randomModel);
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();

    // 2. Verify initial state
    await agentInfoAssertion.assertElementText(
      chat.getAgentInfo().agentName,
      ExpectedConstants.model,
    );
    await chat.getSendMessage().waitForState({ state: 'attached' });

    // 3. Navigate to Marketplace
    await chat.changeAgentButton.click();
    await talkToAgentDialog.goToMyWorkspace();

    // 4. Click "Back to Chat"
    await header.backToChatButton.click();
    await dialHomePage.waitForPageLoaded({ skipSidebars: true });

    // 5. Verify final state
    await agentInfoAssertion.assertElementText(
      chat.getAgentInfo().agentName,
      ExpectedConstants.model,
    );
    await chat.getSendMessage().waitForState({ state: 'attached' });
  },
);
