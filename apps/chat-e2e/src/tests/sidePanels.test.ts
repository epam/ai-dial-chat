import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { expect } from '@playwright/test';

dialTest(
  'Hide panel with chats.\n' +
    'Hide panel with prompts.\n' +
    "Browser refresh doesn't open hidden panels",
  async ({ dialHomePage, setTestIds, chatBar, header, promptBar }) => {
    setTestIds('EPMRTC-352', 'EPMRTC-353', 'EPMRTC-354');
    let isChatPanelVisible;
    let isPromptsPanelVisible;

    await dialTest.step('Hide chat panel', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await header.chatPanelToggle.click();
      isChatPanelVisible = await chatBar.isVisible();
      expect
        .soft(isChatPanelVisible, ExpectedMessages.sideBarPanelIsHidden)
        .toBeFalsy();
    });

    await dialTest.step('Hide prompts panel', async () => {
      await header.promptsPanelToggle.click();
      isPromptsPanelVisible = await promptBar.isVisible();
      expect
        .soft(isPromptsPanelVisible, ExpectedMessages.sideBarPanelIsHidden)
        .toBeFalsy();
    });

    await dialTest.step(
      'Refresh page and verify both panels are hidden',
      async () => {
        await dialHomePage.reloadPage();
        isChatPanelVisible = await chatBar.isVisible();
        isPromptsPanelVisible = await promptBar.isVisible();
        for (const isPanelVisible of [
          isChatPanelVisible,
          isPromptsPanelVisible,
        ]) {
          expect
            .soft(isPanelVisible, ExpectedMessages.sideBarPanelIsHidden)
            .toBeFalsy();
        }
      },
    );
  },
);

dialTest(
  'Resize panels max and min size.\n' +
    'Resized panels are stored if to close/open or refresh.\n' +
    'Resize panel with chats max and min size.\n' +
    'Resize panel with prompts max and min size',
  async ({
    dialHomePage,
    setTestIds,
    appContainer,
    chatBar,
    promptBar,
    header,
    tooltip,
  }) => {
    setTestIds('EPMRTC-1642', 'EPMRTC-1650', 'EPMRTC-1641', 'EPMRTC-1647');
    let appBounding;
    let maxChatBarBounding;
    let maxPromptBarBounding;

    await dialTest.step(
      'Open app, hover over resize chat panel icon and verify it is highlighted',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        appBounding = await appContainer.getElementBoundingBox();

        await chatBar.resizeIcon.hoverOver({ force: true });
        const iconColor = await chatBar.resizeIcon.getComputedStyleProperty(
          Styles.color,
        );
        expect
          .soft(iconColor[0], ExpectedMessages.iconColorIsValid)
          .toBe(Colors.textAccentSecondary);
      },
    );

    await dialTest.step(
      'Resize chat panel to max size and verify max width',
      async () => {
        await chatBar.resizePanelWidth(appBounding!.width);
        maxChatBarBounding = await chatBar.getElementBoundingBox();
        expect
          .soft(
            maxChatBarBounding!.width,
            ExpectedMessages.sideBarPanelWidthIsValid,
          )
          .toBeCloseTo(
            appBounding!.width * ExpectedConstants.maxSidePanelWidthPercentage,
            0,
          );
      },
    );

    await dialTest.step(
      'Verify Attachment icon is visible at the panel bottom menu',
      async () => {
        await chatBar.attachments.waitForState();
        const isDotsMenuVisible = await chatBar.bottomDotsMenuIcon.isVisible();
        expect
          .soft(isDotsMenuVisible, ExpectedMessages.dotsMenuIsHidden)
          .toBeFalsy();

        await chatBar.attachments.hoverOver();
        const iconTooltip = await tooltip.getContent();
        expect
          .soft(iconTooltip, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.attachments);

        const iconColor = await chatBar.attachments.getComputedStyleProperty(
          Styles.color,
        );
        expect
          .soft(iconColor[0], ExpectedMessages.iconColorIsValid)
          .toBe(Colors.textAccentSecondary);
      },
    );

    await dialTest.step(
      'Hover over resize prompt panel icon and verify it is highlighted',
      async () => {
        await promptBar.resizeIcon.hoverOver({ force: true });
        const iconColor = await promptBar.resizeIcon.getComputedStyleProperty(
          Styles.color,
        );
        expect
          .soft(iconColor[0], ExpectedMessages.iconColorIsValid)
          .toBe(Colors.textSecondary);
      },
    );

    await dialTest.step(
      'Resize prompt panel to max size and verify max width',
      async () => {
        await promptBar.resizePanelWidth(appBounding!.x);
        maxPromptBarBounding = await promptBar.getElementBoundingBox();
        expect
          .soft(
            maxPromptBarBounding!.width,
            ExpectedMessages.sideBarPanelWidthIsValid,
          )
          .toBeCloseTo(
            appBounding!.width * ExpectedConstants.maxSidePanelWidthPercentage,
            0,
          );
      },
    );

    await dialTest.step(
      'Hide both panels, open again and verify panels size is stored',
      async () => {
        for (let i = 1; i <= 2; i++) {
          await header.chatPanelToggle.click();
          await header.promptsPanelToggle.click();
        }
        const openedChatBarPanelBounding =
          await chatBar.getElementBoundingBox();
        const openedPromptsBarPanelBounding =
          await promptBar.getElementBoundingBox();
        expect
          .soft(
            openedChatBarPanelBounding!.width,
            ExpectedMessages.sideBarPanelWidthIsValid,
          )
          .toBeCloseTo(maxChatBarBounding!.width, 0);
        expect
          .soft(
            openedPromptsBarPanelBounding!.width,
            ExpectedMessages.sideBarPanelWidthIsValid,
          )
          .toBeCloseTo(maxPromptBarBounding!.width, 0);
      },
    );

    await dialTest.step(
      'Refresh page and verify panels size is stored',
      async () => {
        await dialHomePage.reloadPage();
        const openedChatBarPanelBounding =
          await chatBar.getElementBoundingBox();
        const openedPromptsBarPanelBounding =
          await promptBar.getElementBoundingBox();
        expect
          .soft(
            openedChatBarPanelBounding!.width,
            ExpectedMessages.sideBarPanelWidthIsValid,
          )
          .toBeCloseTo(maxChatBarBounding!.width, 0);
        expect
          .soft(
            openedPromptsBarPanelBounding!.width,
            ExpectedMessages.sideBarPanelWidthIsValid,
          )
          .toBeCloseTo(maxPromptBarBounding!.width, 0);
      },
    );

    await dialTest.step(
      'Resize chat panel to min size and verify min width',
      async () => {
        await chatBar.resizePanelWidth(appBounding!.x);
        const chatBarBounding = await chatBar.getElementBoundingBox();
        expect
          .soft(
            chatBarBounding!.width,
            ExpectedMessages.sideBarPanelWidthIsValid,
          )
          .toBeCloseTo(ExpectedConstants.minSidePanelWidthPx, 0);
      },
    );

    await dialTest.step(
      'Verify dots menu is visible at the panel bottom menu',
      async () => {
        await chatBar.bottomDotsMenuIcon.waitForState();
        const isAttachmentsIconVisible = await chatBar.attachments.isVisible();
        expect
          .soft(isAttachmentsIconVisible, ExpectedMessages.iconIsHidden)
          .toBeFalsy();

        await chatBar.bottomDotsMenuIcon.hoverOver();
        const dotsMenuIconColor =
          await chatBar.bottomDotsMenuIcon.getComputedStyleProperty(
            Styles.color,
          );
        expect
          .soft(dotsMenuIconColor[0], ExpectedMessages.iconColorIsValid)
          .toBe(Colors.controlsBackgroundDisable);
      },
    );

    await dialTest.step(
      'Resize prompt panel to min size and verify min width',
      async () => {
        await promptBar.resizePanelWidth(appBounding!.width);
        const promptBarBounding = await promptBar.getElementBoundingBox();
        expect
          .soft(
            promptBarBounding!.width,
            ExpectedMessages.sideBarPanelWidthIsValid,
          )
          .toBeCloseTo(ExpectedConstants.minSidePanelWidthPx, 0);
      },
    );
  },
);
