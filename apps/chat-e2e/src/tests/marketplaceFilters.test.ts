import { EntityType } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  MarketplaceFilterTypes,
  SourcesFilterOptions,
} from '@/src/testData';
import { Attributes, Cursors, ThemeColorAttributes } from '@/src/ui/domData';
import { DialHomePage, MarketplacePage } from '@/src/ui/pages';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Locator } from '@playwright/test';

dialTest(
  'Only existed Filters are applied, My workspace is opened for another user if user opens the URL. User has already logged in.\n' +
    'Filters are unselected after logout.\n' +
    'Search_phrase is cleared after logout',
  async (
    {
      marketplacePage,
      marketplaceFilter,
      setTestIds,
      baseAssertion,
      page,
      marketplaceHeader,
      providerLogin,
      marketplaceSidebar,
      dialHomePage,
      chatBar,
      marketplaceUrlBuilder,
      context,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-4485', 'EPMRTC-5241', 'EPMRTC-5242');
    let url: string;

    await dialTest.step(
      'Open workspace url with Type="Applications" and Sources="My Custom apps" params by logged-in user and verify no Source filter is available, Type="Applications" filter is checked',
      async () => {
        url = marketplaceUrlBuilder
          .withTypes(EntityType.Application)
          .withSources(SourcesFilterOptions.myCustomApps)
          .withTab('workspace')
          .build();
        await marketplacePage.navigateToUrl(url);
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(
          marketplaceFilter.filterByPropertyOptions(
            MarketplaceFilterTypes.type,
          ),
          'visible',
        );
        await baseAssertion.assertCheckboxState(
          marketplaceFilter.filterByPropertyOptionInput(
            MarketplaceFilterTypes.type,
            EntityType.Application,
          ),
          CheckboxState.checked,
        );
        await baseAssertion.assertElementState(
          marketplaceFilter.filterByPropertyOptions(
            MarketplaceFilterTypes.sources,
          ),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Set any search term and verify it is added as a param to the url',
      async () => {
        const searchTerm = GeneratorUtil.randomString(5);
        await marketplaceHeader.searchInput.fillInInput(searchTerm);
        await baseAssertion.assertElementAttribute(
          marketplaceHeader.searchInput,
          Attributes.value,
          searchTerm,
        );
        const expectedUrl = marketplaceUrlBuilder
          .withTypes(EntityType.Application)
          .withTab('workspace')
          .withSearch(searchTerm)
          .build();
        baseAssertion.assertValue(page.url(), expectedUrl);
      },
    );

    await dialTest.step(
      'Logout, re-login again and verify filters and search term are reset on the "My Workspace" tab',
      async () => {
        await context.clearCookies();
        await providerLogin.login(
          testInfo,
          process.env.E2E_USERNAME!.split(',')[+testInfo.parallelIndex],
          process.env.E2E_PASSWORD!,
          false,
        );
        await dialHomePage.waitForPageLoaded();
        await chatBar.dialMarketplaceLink.click();
        await marketplacePage.waitForPageLoaded();
        await marketplaceSidebar.myWorkspaceButton.click();
        await baseAssertion.assertCheckboxState(
          marketplaceFilter.filterByPropertyOptionInput(
            MarketplaceFilterTypes.type,
            EntityType.Application,
          ),
          CheckboxState.unchecked,
        );
        await baseAssertion.assertElementAttribute(
          marketplaceHeader.searchInput,
          Attributes.value,
          '',
        );
      },
    );
  },
);

dialTest(
  'Filters are applied, DIAL Marketplace is opened for another user if user opens the URL. User has to log-in firstly.\n' +
    'Search phrase is cleared if to reopen DIAL Marketplace.\n' +
    'Filters are unselected if to reopen DIAL Marketplace',
  async (
    {
      customApplicationBuilder,
      applicationApiHelper,
      incognitoPage,
      incognitoProviderLogin,
      setTestIds,
      baseAssertion,
      marketplaceUrlBuilder,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-5272', 'EPMRTC-4314', 'EPMRTC-4333');
    const appName = GeneratorUtil.randomApplicationName();
    const firstTopic = GeneratorUtil.randomString(5);
    const secondTopic = GeneratorUtil.randomString(5);
    const url = marketplaceUrlBuilder
      .withTypes(EntityType.Application)
      .withSources(SourcesFilterOptions.myCustomApps)
      .withTopics(firstTopic, secondTopic)
      .withTab('workspace')
      .build();
    const username =
      process.env.E2E_USERNAME!.split(',')[testInfo.parallelIndex];
    const incognitoMarketplacePage = new MarketplacePage(incognitoPage);
    const incognitoMarketplaceContainer =
      incognitoMarketplacePage.getMarketplaceContainer();
    const incognitoMarketplaceHeader = incognitoMarketplaceContainer
      .getMarketplace()
      .getMarketplaceHeader();
    const incognitoMarketplaceFilter = incognitoMarketplaceContainer
      .getMarketplaceSidebar()
      .getMarketplaceFilter();
    const incognitoDialHomePage = new DialHomePage(incognitoPage);
    const incognitoAppContainer = incognitoDialHomePage.getAppContainer();
    const operationFiltersStateMap = new Map<string, CheckboxState>([
      ['login', CheckboxState.checked],
      ['go-back', CheckboxState.unchecked],
    ]);

    await dialTest.step(
      'Prepare custom application with some topics',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(GeneratorUtil.randomApplicationVersion())
          .withDescriptionKeywords(firstTopic, secondTopic)
          .build();
        await applicationApiHelper.createApplication(applicationModel);
      },
    );

    for (const [operation, filterState] of operationFiltersStateMap.entries()) {
      await dialTest.step(
        `Verify all filters are available and ${filterState} on ${operation}`,
        async () => {
          switch (operation) {
            case 'login':
              await incognitoProviderLogin.login(
                testInfo,
                username,
                process.env.E2E_PASSWORD!,
                false,
                url,
              );
              break;
            case 'go-back':
              await incognitoMarketplaceHeader.searchInput.fillInInput(
                GeneratorUtil.randomString(5),
              );
              await incognitoAppContainer.getHeader().backToChatButton.click();
              await incognitoDialHomePage.waitForPageLoaded();
              await incognitoAppContainer
                .getChatBar()
                .dialMarketplaceLink.click();
              break;
          }
          await incognitoMarketplacePage.waitForPageLoaded();
          await baseAssertion.assertElementState(
            incognitoMarketplaceFilter.filterByPropertyOptions(
              MarketplaceFilterTypes.type,
            ),
            'visible',
          );
          await baseAssertion.assertCheckboxState(
            incognitoMarketplaceFilter.filterByPropertyOptionInput(
              MarketplaceFilterTypes.type,
              EntityType.Application,
            ),
            filterState,
          );
          await baseAssertion.assertElementState(
            incognitoMarketplaceFilter.filterByPropertyOptions(
              MarketplaceFilterTypes.sources,
            ),
            'visible',
          );
          await baseAssertion.assertCheckboxState(
            incognitoMarketplaceFilter.filterByPropertyOptionInput(
              MarketplaceFilterTypes.sources,
              SourcesFilterOptions.myCustomApps,
            ),
            filterState,
          );

          await baseAssertion.assertElementState(
            incognitoMarketplaceFilter.filterByPropertyOptions(
              MarketplaceFilterTypes.topics,
            ),
            'visible',
          );
          await baseAssertion.assertCheckboxState(
            incognitoMarketplaceFilter.filterByPropertyOptionInput(
              MarketplaceFilterTypes.topics,
              firstTopic,
            ),
            filterState,
          );
          await baseAssertion.assertCheckboxState(
            incognitoMarketplaceFilter.filterByPropertyOptionInput(
              MarketplaceFilterTypes.topics,
              secondTopic,
            ),
            filterState,
          );
          await baseAssertion.assertElementAttribute(
            incognitoMarketplaceHeader.searchInput,
            Attributes.value,
            '',
          );
        },
      );
    }
  },
);

dialTest(
  'Types: the mouse is changed and check box is blue-bordered on hover.\n' +
    'Topics: the mouse is changed and check box is blue-bordered on hover.\n' +
    'Types: the type is selected/unselected if to click on check box, name, any place in the row.\n' +
    'Topics: the topic is selected/unselected if to click on check box, name, any place in the row.\n' +
    'Types: expand and collapse, the type stays selected.\n' +
    'Topics: expand and collapse, the topics stay selected',
  async ({
    marketplacePage,
    marketplaceFilter,
    setTestIds,
    baseAssertion,
    page,
  }) => {
    setTestIds(
      'EPMRTC-4430',
      'EPMRTC-4483',
      'EPMRTC-4431',
      'EPMRTC-4486',
      'EPMRTC-4432',
      'EPMRTC-4484',
    );
    let filter: Locator;
    let filterOptions: Locator;
    let filterChevronIcon: Locator;
    let checkboxRowElement: Locator;
    let checkboxInputElement: Locator;
    let checkboxLabelElement: Locator;
    const expectedBorderColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textAccentPrimary,
    );
    const expectedBackgroundColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.bgLayer3,
    );
    const filterTypes = [
      MarketplaceFilterTypes.type,
      MarketplaceFilterTypes.topics,
    ];

    await dialTest.step('Open Dial Marketplace', async () => {
      await marketplacePage.openMarketplacePage();
      await marketplacePage.waitForPageLoaded();
    });

    for (const filterType of filterTypes) {
      await dialTest.step(
        `Verify filter ${filterType.toString()} checkbox is highlighted on hover over checkbox row, cursor is changed to pointer`,
        async () => {
          const randomTypeOption = GeneratorUtil.randomArrayElement(
            await marketplaceFilter.filterByPropertyOptionLabels(filterType),
          );

          checkboxRowElement = marketplaceFilter.filterByPropertyOption(
            filterType,
            randomTypeOption,
          );
          checkboxInputElement = marketplaceFilter.filterByPropertyOptionInput(
            filterType,
            randomTypeOption,
          );
          checkboxLabelElement = marketplaceFilter.filterByPropertyOptionLabel(
            filterType,
            randomTypeOption,
          );

          for (const element of [
            checkboxRowElement,
            checkboxInputElement,
            checkboxLabelElement,
          ]) {
            //verify cursor and checkbox highlighting
            await element.hover();
            await baseAssertion.assertElementCursor(
              checkboxRowElement,
              Cursors.pointer,
            );
            await baseAssertion.assertElementBorderColors(
              checkboxInputElement,
              expectedBorderColor,
            );
            await baseAssertion.assertElementBackgroundColors(
              checkboxInputElement,
              expectedBackgroundColor,
            );

            //verify checkbox can be checked/unchecked
            for (const checkboxState of [
              CheckboxState.checked,
              CheckboxState.unchecked,
            ]) {
              await element.click();
              await baseAssertion.assertCheckboxState(
                checkboxInputElement,
                checkboxState,
              );
            }
            await page.mouse.move(0, 0);
          }
        },
      );

      await dialTest.step(
        'Verify filter sections are expanded by default',
        async () => {
          filter = marketplaceFilter.filterByProperty(filterType);
          await baseAssertion.assertElementAttribute(
            filter,
            Attributes.ariaExpanded,
            'true',
          );
        },
      );

      await dialTest.step(
        `Verify checkbox state is saved on collapse/expand filter ${filterType.toString()} section`,
        async () => {
          filterOptions = marketplaceFilter.filterByPropertyOptions(filterType);
          filterChevronIcon =
            marketplaceFilter.filterByPropertyChevronIcon(filterType);
          await checkboxRowElement.click();
          await baseAssertion.assertCheckboxState(
            checkboxRowElement,
            CheckboxState.checked,
          );
          await filter.click();
          await baseAssertion.assertElementAttribute(
            filter,
            Attributes.ariaExpanded,
            'false',
          );
          await baseAssertion.assertElementState(filterOptions, 'hidden');
          await baseAssertion.assertElementClass(
            filterChevronIcon,
            new RegExp(Attributes.rotated180),
          );
          await filter.click();
          await baseAssertion.assertElementAttribute(
            filter,
            Attributes.ariaExpanded,
            'true',
          );
          await baseAssertion.assertElementState(filterOptions, 'visible');
          await baseAssertion.assertCheckboxState(
            checkboxRowElement,
            CheckboxState.checked,
          );
        },
      );
    }
  },
);
