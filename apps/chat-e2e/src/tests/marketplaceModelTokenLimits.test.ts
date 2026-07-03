import { MarketplaceI18nKeys } from '@/chat/constants/i18n';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants } from '@/src/testData';
import { ModelLimitsMockHelper } from '@/src/testData/marketplace/modelLimitsMockHelper';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

let model: DialAIEntityModel;

dialTest.beforeAll(async () => {
  model = GeneratorUtil.randomArrayElement(ModelsUtil.getModels());
});

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
    setTestIds('EPMRTC-9077', 'EPMRTC-9078');

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
