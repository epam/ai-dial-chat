import { MarketplaceI18nKeys } from '@/chat/constants/i18n';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants } from '@/src/testData';
import {
  FORMATTED_LIMITED_TOKENS,
  FORMATTED_USED_TOKENS,
  ModelLimitsMockHelper,
  dailyAndWeeklyTokensStats,
  minuteDailyMonthlyTokensStats,
  monthlyTokensStats,
} from '@/src/testData/marketplace/modelLimitsMockHelper';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

dialTest(
  'Token limits section is collapsed by default.\n' +
    "'No limits applied' text is shown in Token limits section when all limits are unlimited",
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    entityDetailsModalAssertion,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2624', 'EPMDIAL-2625');

    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels(),
    );

    await dialTest.step(
      'Set up limits API mock to return unlimited stats',
      async () => {
        const modelLimitsMockHelper = new ModelLimitsMockHelper(page, model);
        await modelLimitsMockHelper.mockLimitsResponse();
      },
    );

    await dialTest.step(
      'Open Marketplace page and find the model without set limits',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.getSearch().inputField.fillInInput(model.name);
        const modelElement =
          await marketplaceEntitiesSection.findEntityElement(model);
        await modelElement.click();
      },
    );

    await dialTest.step(
      `Verify 'Token limits' section is collapsed by default`,
      async () => {
        await entityDetailsModalAssertion.assertSectionExpandedState(
          'collapsed',
          MarketplaceI18nKeys.TokenLimits,
        );
      },
    );

    await dialTest.step(
      `Expand the section and verify no limits applied label is displayed`,
      async () => {
        await entityDetailsModal
          .sectionByKeyCaret(MarketplaceI18nKeys.TokenLimits)
          .click();
        await entityDetailsModalAssertion.assertSectionExpandedState(
          'expanded',
          MarketplaceI18nKeys.TokenLimits,
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.limitsGrid,
          'hidden',
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.noLimitsApplied,
          'visible',
        );
        await entityDetailsModalAssertion.assertElementText(
          entityDetailsModal.noLimitsApplied,
          ExpectedConstants.noLimitsApplied,
        );
      },
    );

    await dialTest.step(
      "Reload the page and verify 'Token limits' section stays collapsed",
      async () => {
        await marketplacePage.reloadPage();
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModalAssertion.assertSectionExpandedState(
          'collapsed',
          MarketplaceI18nKeys.TokenLimits,
        );
      },
    );
  },
);

dialTest(
  '[Token limits] Bar with the limit appear only when the limit is set',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    entityDetailsModalAssertion,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2627');

    const [model1, model2, model3] = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels(),
      3,
    );

    await dialTest.step(
      'Set up limits API mocks for three model configurations',
      async () => {
        await new ModelLimitsMockHelper(page, model1).mockLimitsResponse(
          monthlyTokensStats,
        );
        await new ModelLimitsMockHelper(page, model2).mockLimitsResponse(
          dailyAndWeeklyTokensStats,
        );
        await new ModelLimitsMockHelper(page, model3).mockLimitsResponse(
          minuteDailyMonthlyTokensStats,
        );
      },
    );

    await dialTest.step('Open Marketplace page', async () => {
      await marketplacePage.openMarketplacePage();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Open model1 (monthly limit) and verify only Monthly bar is shown',
      async () => {
        await marketplaceHeader.getSearch().inputField.fillInInput(model1.name);
        const model1Element =
          await marketplaceEntitiesSection.findEntityElement(model1);
        await model1Element.click();
        await entityDetailsModal
          .sectionByKeyCaret(MarketplaceI18nKeys.TokenLimits)
          .click();
        await entityDetailsModalAssertion.assertLimitItems([
          MarketplaceI18nKeys.Monthly,
        ]);
        await entityDetailsModalAssertion.assertLimitItemValues(
          MarketplaceI18nKeys.Monthly,
          FORMATTED_USED_TOKENS,
          FORMATTED_LIMITED_TOKENS,
        );
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Open model2 (daily + weekly limits) and verify only Daily and Weekly bars are shown',
      async () => {
        await marketplaceHeader.getSearch().inputField.fillInInput(model2.name);
        const model2Element =
          await marketplaceEntitiesSection.findEntityElement(model2);
        await model2Element.click();
        await entityDetailsModal
          .sectionByKeyCaret(MarketplaceI18nKeys.TokenLimits)
          .click();
        await entityDetailsModalAssertion.assertLimitItems([
          MarketplaceI18nKeys.Daily,
          MarketplaceI18nKeys.Weekly,
        ]);
        for (const key of [
          MarketplaceI18nKeys.Daily,
          MarketplaceI18nKeys.Weekly,
        ]) {
          await entityDetailsModalAssertion.assertLimitItemValues(
            key,
            FORMATTED_USED_TOKENS,
            FORMATTED_LIMITED_TOKENS,
          );
        }
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Open model3 (minute + daily + monthly limits) and verify only Minute, Daily, Monthly bars are shown',
      async () => {
        await marketplaceHeader.getSearch().inputField.fillInInput(model3.name);
        const model3Element =
          await marketplaceEntitiesSection.findEntityElement(model3);
        await model3Element.click();
        await entityDetailsModal
          .sectionByKeyCaret(MarketplaceI18nKeys.TokenLimits)
          .click();
        await entityDetailsModalAssertion.assertLimitItems([
          MarketplaceI18nKeys.Minute,
          MarketplaceI18nKeys.Daily,
          MarketplaceI18nKeys.Monthly,
        ]);
        for (const key of [
          MarketplaceI18nKeys.Minute,
          MarketplaceI18nKeys.Daily,
          MarketplaceI18nKeys.Monthly,
        ]) {
          await entityDetailsModalAssertion.assertLimitItemValues(
            key,
            FORMATTED_USED_TOKENS,
            FORMATTED_LIMITED_TOKENS,
          );
        }
      },
    );
  },
);
