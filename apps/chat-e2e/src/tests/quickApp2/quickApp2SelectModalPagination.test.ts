import dialTest from '@/src/core/dialFixtures';
import { EntityEditorAppTypes, ExpectedMessages } from '@/src/testData';
import { Cursors, ThemeColorAttributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, entityNamePrefix } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

// Six cards fit one page on the e2e viewport, so 13 items give three pages.
const agentsCount = 7;
const toolsetsCount = 6;

dialTest(
  '[Dots pagination][Select agents and toolsets] Navigation clicking on arrows using mouse\n' + // EPMDIAL-4913
    '[Dots pagination][Select agents and toolsets] Navigation clicking on arrows on keyboard\n' + // EPMDIAL-4915
    '[Dots pagination][Select agents and toolsets] Navigation clicking on circles using mouse\n' + // EPMDIAL-4914
    '[Dots pagination][Select agents and toolsets] The amount of pages differs on Marketplace/My workspace\n' + // EPMDIAL-4919
    '[Dots pagination][Select agents and toolsets] The slider is moved to the first page if to switch between Marketplace/My workspace\n' + // EPMDIAL-4918
    '[Dots pagination][Select agents and toolsets] The first slider position with search results is shown if to perform the search when not the first slider is opened\n' + // EPMDIAL-4916
    '[Dots pagination][Select agents and toolsets] The slider disappears after the search when search results are located on the one page only', // EPMDIAL-4917
  async ({
    page,
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    agentAndToolsetSelectModalAssertion,
    agentAndToolsetSelectModalSliderDots,
    agentAndToolsetSelectModalSliderDotsAssertion,
    customApplicationBuilder,
    toolsetBuilder,
    applicationApiHelper,
    toolsetApiHelper,
    fileApiHelper,
    mainUserShareApiHelper,
    localStorageManager,
    baseAssertion,
    setTestIds,
  }) => {
    dialTest.slow();
    setTestIds(
      'EPMDIAL-4913',
      'EPMDIAL-4915',
      'EPMDIAL-4914',
      'EPMDIAL-4919',
      'EPMDIAL-4918',
      'EPMDIAL-4916',
      'EPMDIAL-4917',
    );
    const agentNames = Array.from({ length: agentsCount }, () =>
      GeneratorUtil.randomApplicationName(),
    );
    const toolsetNames = Array.from({ length: toolsetsCount }, () =>
      GeneratorUtil.randomToolsetName(),
    );
    // A full random name matches nothing but itself, so the search returns one card.
    const singleResultToolsetName = toolsetNames[0];
    const quickAppName = GeneratorUtil.randomApplicationName();
    let lastPage: number;
    let myWorkspacePagesCount: number;
    let marketplacePagesCount: number;

    await dialTest.step(
      `Precondition: start from a clean workspace and create ${agentsCount} agents and ${toolsetsCount} toolsets`,
      async () => {
        const sharedApps = await mainUserShareApiHelper.listSharedWithMeApps();
        await mainUserShareApiHelper.deleteSharedWithMeEntities(
          sharedApps.resources,
        );
        await fileApiHelper.updateInstalledDeployments([]);
        await fileApiHelper.updateInstalledToolsets([]);
        await localStorageManager.setRecentModelsIds();

        for (const name of agentNames) {
          await applicationApiHelper.createApplication(
            customApplicationBuilder.withDisplayName(name).build(),
          );
        }
        for (const name of toolsetNames) {
          await toolsetApiHelper.createToolset(
            toolsetBuilder.withDisplayName(name).build(),
          );
        }
      },
    );

    await dialTest.step(
      'Open Quick app 2.0 creation page and open the select modal',
      async () => {
        await marketplacePage.openCreateQuickApp2Page({
          updateInstalledEntities: false,
        });
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'On the Marketplace tab the first page is active and the left arrow is disabled',
      async () => {
        await agentAndToolsetSelectModal.marketplaceTab.click();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertPagesCountIsGreaterThan(
          1,
        );
        lastPage =
          (await agentAndToolsetSelectModalSliderDots.getPagesCount()) - 1;
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(0);
        await baseAssertion.assertElementActionabilityState(
          agentAndToolsetSelectModalSliderDots.previousArrow,
          'disabled',
        );
        await baseAssertion.assertElementCursor(
          agentAndToolsetSelectModalSliderDots.previousArrow,
          Cursors.notAllowed,
        );
        // A disabled arrow is not clickable, so force the click to prove nothing happens.
        await agentAndToolsetSelectModalSliderDots.previousArrow.click({
          force: true,
        });
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(0);
      },
    );

    await dialTest.step(
      'The right arrow highlights on hover and opens the next page on click',
      async () => {
        await agentAndToolsetSelectModalSliderDots.nextArrow.hoverOver();
        await baseAssertion.assertElementCursor(
          agentAndToolsetSelectModalSliderDots.nextArrow,
          Cursors.pointer,
        );
        await baseAssertion.assertElementColor(
          agentAndToolsetSelectModalSliderDots.nextArrow,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );

        const firstPageEntities =
          await agentAndToolsetSelectModal.getPageEntityNames(0);
        await agentAndToolsetSelectModalSliderDots.nextArrow.click();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(1);
        baseAssertion.assertValuesAreNotEqual(
          await agentAndToolsetSelectModal.getPageEntityNames(1),
          firstPageEntities,
          ExpectedMessages.searchResultsAreCorrect,
        );
      },
    );

    await dialTest.step(
      'The right arrow gets disabled on the last page and does not move further',
      async () => {
        await agentAndToolsetSelectModalSliderDots.goToLastPage();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(
          lastPage,
        );
        await baseAssertion.assertElementActionabilityState(
          agentAndToolsetSelectModalSliderDots.nextArrow,
          'disabled',
        );
        await baseAssertion.assertElementCursor(
          agentAndToolsetSelectModalSliderDots.nextArrow,
          Cursors.notAllowed,
        );
        await agentAndToolsetSelectModalSliderDots.nextArrow.click({
          force: true,
        });
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(
          lastPage,
        );
      },
    );

    await dialTest.step(
      'The left arrow highlights on hover and opens the previous page on click',
      async () => {
        await agentAndToolsetSelectModalSliderDots.previousArrow.hoverOver();
        await baseAssertion.assertElementCursor(
          agentAndToolsetSelectModalSliderDots.previousArrow,
          Cursors.pointer,
        );
        await baseAssertion.assertElementColor(
          agentAndToolsetSelectModalSliderDots.previousArrow,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await agentAndToolsetSelectModalSliderDots.previousArrow.click();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(
          lastPage - 1,
        );
      },
    );

    await dialTest.step(
      'Keyboard arrows scroll the pages and stop on the last and the first one',
      async () => {
        await page.keyboard.press(keys.arrowLeft);
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(
          lastPage - 2 >= 0 ? lastPage - 2 : 0,
        );
        // Several fast presses in a row must be applied one by one.
        for (let pressCount = 0; pressCount < lastPage; pressCount++) {
          await page.keyboard.press(keys.arrowRight);
        }
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(
          lastPage,
        );
        await page.keyboard.press(keys.arrowRight);
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(
          lastPage,
        );
        for (let pressCount = 0; pressCount < lastPage; pressCount++) {
          await page.keyboard.press(keys.arrowLeft);
        }
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(0);
        await page.keyboard.press(keys.arrowLeft);
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(0);
      },
    );

    await dialTest.step(
      'A circle keeps its colour on hover and opens its page on click',
      async () => {
        const nextDot = agentAndToolsetSelectModalSliderDots.getDotButton(1);
        await nextDot.hoverOver();
        await baseAssertion.assertElementCursor(nextDot, Cursors.pointer);
        await baseAssertion.assertElementBackgroundColors(
          nextDot,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSecondary),
        );

        const firstPageEntities =
          await agentAndToolsetSelectModal.getPageEntityNames(0);
        await agentAndToolsetSelectModalSliderDots.openNextPageByDot();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(1);
        baseAssertion.assertValuesAreNotEqual(
          await agentAndToolsetSelectModal.getPageEntityNames(1),
          firstPageEntities,
          ExpectedMessages.searchResultsAreCorrect,
        );

        await agentAndToolsetSelectModalSliderDots.openPreviousPageByDot();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(0);
        baseAssertion.assertValuesAreEqual(
          await agentAndToolsetSelectModal.getPageEntityNames(0),
          firstPageEntities,
          ExpectedMessages.searchResultsAreCorrect,
        );
      },
    );

    await dialTest.step(
      'The Marketplace tab has more pages than My workspace',
      async () => {
        await agentAndToolsetSelectModal.myWorkspaceTab.click();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertPagesCountIsGreaterThan(
          1,
        );
        myWorkspacePagesCount =
          await agentAndToolsetSelectModalSliderDots.getPagesCount();

        await agentAndToolsetSelectModal.marketplaceTab.click();
        marketplacePagesCount =
          await agentAndToolsetSelectModalSliderDots.getPagesCount();
        baseAssertion.assertNumberIsGreaterThan(
          marketplacePagesCount,
          myWorkspacePagesCount,
          ExpectedMessages.sliderPagesCountIsValid,
        );
      },
    );

    await dialTest.step(
      'The slider goes back to the first page on every tab switch',
      async () => {
        await agentAndToolsetSelectModalSliderDots.goToLastPage();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(
          marketplacePagesCount - 1,
        );

        await agentAndToolsetSelectModal.myWorkspaceTab.click();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(0);
        await agentAndToolsetSelectModalSliderDots.goToLastPage();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(
          myWorkspacePagesCount - 1,
        );

        await agentAndToolsetSelectModal.marketplaceTab.click();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(0);
      },
    );

    await dialTest.step(
      'A search performed on a non-first page shows its results from the first page',
      async () => {
        await agentAndToolsetSelectModalSliderDots.openNextPageByDot();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(1);
        // The E2E prefix matches every created item, so the results keep several pages.
        await agentAndToolsetSelectModal.searchInput.fillInInput(
          entityNamePrefix,
        );
        await agentAndToolsetSelectModalSliderDotsAssertion.assertPagesCountIsGreaterThan(
          1,
        );
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(0);
      },
    );

    await dialTest.step(
      'The slider disappears when the search results fit one page',
      async () => {
        await agentAndToolsetSelectModalSliderDots.openNextPageByDot();
        await agentAndToolsetSelectModalSliderDotsAssertion.assertActivePage(1);
        await agentAndToolsetSelectModal.searchInput.fillInInput(
          singleResultToolsetName,
        );
        await agentAndToolsetSelectModalAssertion.assertDisplayedEntities({
          visible: [singleResultToolsetName],
        });
        await baseAssertion.assertElementsCount(
          agentAndToolsetSelectModal.getEntities(),
          1,
          ExpectedMessages.searchResultCountIsValid,
        );
        await agentAndToolsetSelectModalSliderDotsAssertion.assertSliderIsHidden();
      },
    );
  },
);
