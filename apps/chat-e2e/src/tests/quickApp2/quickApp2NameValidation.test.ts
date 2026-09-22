import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  EntityEditorAppTypes,
  ExpectedConstants,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { EntityEditSteps } from '@/src/ui/webElements';
import { GeneratorUtil, applicationNamePrefix } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

dialTest(
  '[Quick app 2.0] Name validation: the field can not be more than 255 bytes (UTF-8)',
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorHeader,
    entityEditorGeneralForm,
    marketplace,
    baseAssertion,
    tooltipAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4758');
    const longName = GeneratorUtil.randomString(300);

    await dialTest.step('Open My workspace', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: true,
        getStyles: true,
      });
    });

    await dialTest.step(
      'Click Add app and select Quick app 2.0 from dropdown',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.quickApp2);
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Fill in app name with more than 255 bytes and verify error label is displayed under the field, app cannot be saved',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({ name: longName });
        await baseAssertion.assertElementState(
          entityEditorGeneralForm.nameErrorLabel,
          'visible',
        );
        await baseAssertion.assertElementText(
          entityEditorGeneralForm.nameErrorLabel,
          ExpectedConstants.appNameTooLongError,
        );
        await baseAssertion.assertElementActionabilityState(
          entityEditorGeneralForm.nextButton,
          'disabled',
        );
        await baseAssertion.assertElementState(
          entityEditorHeader.saveAndExitButton,
          'hidden',
        );
        await baseAssertion.assertElementState(
          entityEditorHeader.exitButton,
          'visible',
        );
        await baseAssertion.assertElementActionabilityState(
          entityEditorHeader.exitButton,
          'enabled',
        );
        await baseAssertion.assertElementBorderColors(
          entityEditorHeader.getGeneralInfoStep(),
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
        );
        await baseAssertion.assertElementState(
          entityEditorHeader.getStepByTitleErrorIcon(
            EntityEditSteps.generalInfo,
          ),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Hover over Next btn and verify tooltip is displayed',
      async () => {
        await entityEditorGeneralForm.nextButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.appRequiredFieldsTooltip,
        );
      },
    );

    await dialTest.step(
      'Click Exit btn and verify app is not created',
      async () => {
        await entityEditorHeader.exitButton.click();
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'hidden',
        );
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.getSearch().inputField.fillInInput(longName);
        await baseAssertion.assertElementText(
          marketplace.noResultsFound,
          ExpectedConstants.noResults,
        );
      },
    );
  },
);

dialTest(
  '[Quick app 2.0] Name validation: the field can not contain restricted special chars',
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorHeader,
    entityEditorGeneralForm,
    marketplace,
    baseAssertion,
    tooltipAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4759');

    await dialTest.step('Open My workspace', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: true,
        getStyles: true,
      });
    });

    await dialTest.step(
      'Click Add app and select Quick app 2.0 from dropdown',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.quickApp2);
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    for (const char of ExpectedConstants.restrictedNameChars.split('')) {
      await dialTest.step(
        `Fill in app name with a prohibited char ${char} and verify error label is displayed under the field, app cannot be saved`,
        async () => {
          await entityEditorGeneralForm.fillInEntityFields({ name: char });
          await baseAssertion.assertElementState(
            entityEditorGeneralForm.nameErrorLabel,
            'visible',
          );
          await baseAssertion.assertElementText(
            entityEditorGeneralForm.nameErrorLabel,
            ExpectedConstants.appNameSpecialCharsError,
          );
          await baseAssertion.assertElementActionabilityState(
            entityEditorGeneralForm.nextButton,
            'disabled',
          );
          await baseAssertion.assertElementState(
            entityEditorHeader.saveAndExitButton,
            'hidden',
          );
          await baseAssertion.assertElementState(
            entityEditorHeader.exitButton,
            'visible',
          );
          await baseAssertion.assertElementActionabilityState(
            entityEditorHeader.exitButton,
            'enabled',
          );
          await baseAssertion.assertElementBorderColors(
            entityEditorHeader.getGeneralInfoStep(),
            ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
          );
          await baseAssertion.assertElementState(
            entityEditorHeader.getStepByTitleErrorIcon(
              EntityEditSteps.generalInfo,
            ),
            'visible',
          );
        },
      );

      await dialTest.step(
        'Hover over Next btn and verify tooltip is displayed',
        async () => {
          await entityEditorGeneralForm.nextButton.hoverOver();
          await tooltipAssertion.assertTooltipContent(
            ExpectedConstants.appRequiredFieldsTooltip,
          );
        },
      );
    }

    await dialTest.step(
      'Click Exit btn and verify app is not created',
      async () => {
        await entityEditorHeader.exitButton.click();
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'hidden',
        );
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(
            ExpectedConstants.restrictedNameChars.split('')[
              ExpectedConstants.restrictedNameChars.length - 1
            ],
          );
        await baseAssertion.assertElementText(
          marketplace.noResultsFound,
          ExpectedConstants.noResults,
        );
      },
    );
  },
);

dialTest(
  '[Quick app 2.0] Name validation: the field can contain allowed special chars',
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorHeader,
    entityEditorGeneralForm,
    entityDetailsModal,
    dialHomePage,
    baseAssertion,
    chat,
    chatMessagesAssertion,
    entityDetailsModalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4758');

    await dialTest.step('Open My workspace', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: true,
        getStyles: true,
      });
    });

    await dialTest.step(
      'Click Add app and select Quick app 2.0 from dropdown',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.quickApp2);
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Fill in app name with allowed char and proceed with app creation',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: applicationNamePrefix + ExpectedConstants.allowedSpecialChars,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Save the app and verify it is successfully created',
      async () => {
        await entityEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedName: ExpectedConstants.allowedSpecialChars,
        });

        await entityDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: false,
        });
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(GeneratorUtil.randomString(10));
        await chatMessagesAssertion.assertMessageContent(2, 'Response');
      },
    );
  },
);
