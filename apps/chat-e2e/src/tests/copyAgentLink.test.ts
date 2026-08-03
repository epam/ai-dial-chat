import { Publication } from '@/chat/types/publication';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, MenuOptions } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];
let isUnpublished = false;

dialTest(
  `Copy link on detailed model card and it's particular version by User1. Open the link by User2 who is logged into DIAL.\n` +
    'Copy link on the detailed card: icon and name is changed on click.\n' +
    'Copy link item in context menu on the card on DIAL Marketplace. Toast message appears.\n' +
    'Copy link on detailed model card by User1. Open the link by User2 who is not logged into DIAL.\n' +
    'Error appears if to click on invalid link.\n' +
    'Error appears if to click on the link when the custom app becomes unpublished',
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceEntitiesSection,
      entityDetailsModal,
      marketplaceEntities,
      toast,
      errorPopup,
      setTestIds,
      baseAssertion,
      customApplicationBuilder,
      adminApplicationApiHelper,
      adminPublicationApiHelper,
      publishRequestBuilder,
      accountSettings,
      providerLogin,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMDIAL-2575',
      'EPMDIAL-2577',
      'EPMDIAL-2578',
      'EPMDIAL-2576',
      'EPMDIAL-2582',
      'EPMDIAL-2583',
    );
    dialTest.slow();
    const appFirstVersion = ExpectedConstants.defaultEntityVersion;
    const appSecondVersion = '0.0.2';
    const appName = GeneratorUtil.randomApplicationName();
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textAccentPrimary,
    );
    let agentElement: BaseElement;
    let cardCopiedLink: string;
    let dotsMenuCopiedLink: string;

    await dialTest.step(
      'Publish a custom application with two versions',
      async () => {
        const customApplicationFirstVersionModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(appFirstVersion)
          .build();
        const customApplicationSecondVersionModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(appSecondVersion)
          .build();

        for (const appModel of [
          customApplicationFirstVersionModel,
          customApplicationSecondVersionModel,
        ]) {
          const adminApp =
            await adminApplicationApiHelper.createApplication(appModel);
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withApplicationResource(adminApp, PublishActions.ADD)
            .build();
          const appPublication =
            await adminPublicationApiHelper.createPublishRequest(
              publishRequest,
            );
          publicationsToUnpublish.push(appPublication);
          await adminPublicationApiHelper.approveRequest(appPublication);
        }
      },
    );

    await dialTest.step(
      'Open "DIAL Marketplace", open created app card and select non-default version',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.getSearch().inputField.fillInInput(appName);
        agentElement =
          await marketplaceEntitiesSection.findEntityElement(appName);
        await agentElement.click();
        await entityDetailsModal.versionMenuTrigger.click();
        await entityDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(appFirstVersion);
      },
    );

    await dialTest.step('Verify "Copy link" text and icon style', async () => {
      await baseAssertion.assertElementColor(
        entityDetailsModal.copyLinkText,
        expectedColor,
      );
      await baseAssertion.assertElementColor(
        entityDetailsModal.copyLinkIcon,
        expectedColor,
      );
    });

    await dialTest.step(
      'Click on "Copy link" text/icon and verify link text and icon are changed for the moment',
      async () => {
        for (const linkElement of [
          entityDetailsModal.copyLinkText,
          entityDetailsModal.copyLinkIcon,
        ]) {
          cardCopiedLink = await marketplacePage.captureNextClipboardWrite(() =>
            linkElement.click(),
          );
          await baseAssertion.assertElementText(
            entityDetailsModal.copiedLink,
            ExpectedConstants.copiedLinkText,
          );
          await baseAssertion.assertElementState(
            entityDetailsModal.copiedLinkIcon,
            'visible',
          );

          await baseAssertion.assertElementText(
            entityDetailsModal.copyLinkText,
            ExpectedConstants.copyLinkText,
          );
          await baseAssertion.assertElementState(
            entityDetailsModal.copyLinkIcon,
            'visible',
          );
        }
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Back to the cards list, open agent card dots menu, select "Copy link" option and verify toast is shown',
      async () => {
        await agentElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        dotsMenuCopiedLink = await marketplacePage.captureNextClipboardWrite(
          () =>
            marketplaceEntities
              .getEntityDropdownMenu()
              .selectMenuOption(MenuOptions.copyLink),
        );
        await baseAssertion.assertElementState(toast, 'visible');
        await baseAssertion.assertElementText(
          toast,
          ExpectedConstants.copiedToastMessage,
        );
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'Navigate to copied link and verify the agent details modal is opened',
      async () => {
        await marketplacePage.navigateToUrl(cardCopiedLink);
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await baseAssertion.assertElementText(
          entityDetailsModal.entityName,
          appName,
        );
        await baseAssertion.assertElementText(
          entityDetailsModal.entityVersion,
          appFirstVersion,
        );
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Logout, open copied link and verify the agent details modal is opened',
      async () => {
        await accountSettings.logout();
        await providerLogin.login(
          testInfo,
          process.env.E2E_USERNAME!.split(',')[+testInfo.parallelIndex],
          process.env.E2E_PASSWORD!,
          false,
          dotsMenuCopiedLink,
        );
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await baseAssertion.assertElementText(
          entityDetailsModal.entityName,
          appName,
        );
        await baseAssertion.assertElementText(
          entityDetailsModal.entityVersion,
          appSecondVersion,
        );
      },
    );

    await dialTest.step(
      'Navigate to not existent link and verify error toast is displayed, cards list is opened',
      async () => {
        await marketplacePage.navigateToUrl(cardCopiedLink + 'error');
        await baseAssertion.assertElementState(errorPopup, 'visible');
        await baseAssertion.assertElementText(
          errorPopup,
          ExpectedConstants.agentNotFoundError,
        );
        await errorPopup.cancelPopup();
        await baseAssertion.assertElementState(entityDetailsModal, 'hidden');
        await baseAssertion.assertElementState(
          marketplaceEntitiesSection,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Unpublish application and verify error toast is displayed on opening copied link',
      async () => {
        for (const publication of publicationsToUnpublish) {
          const unpublishResponse =
            await adminPublicationApiHelper.createUnpublishRequest(publication);
          await adminPublicationApiHelper.approveRequest(unpublishResponse);
        }
        isUnpublished = true;

        await marketplacePage.navigateToUrl(cardCopiedLink);
        await baseAssertion.assertElementState(errorPopup, 'visible');
        await baseAssertion.assertElementText(
          errorPopup,
          ExpectedConstants.agentNotFoundError,
        );
        await errorPopup.cancelPopup();
        await baseAssertion.assertElementState(entityDetailsModal, 'hidden');
        await baseAssertion.assertElementState(
          marketplaceEntitiesSection,
          'visible',
        );
      },
    );
  },
);

dialTest.afterAll(
  async ({ publicationApiHelper, adminPublicationApiHelper }) => {
    if (!isUnpublished) {
      for (const publication of publicationsToUnpublish) {
        const unpublishResponse =
          await publicationApiHelper.createUnpublishRequest(publication);
        await adminPublicationApiHelper.approveRequest(unpublishResponse);
      }
    }
  },
);
