import config from '@/config/chat.playwright.config';
import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { DialHomePage } from '@/src/ui/pages';
import { Favicon } from '@/src/ui/webElements';

dialTest(
  'Favicon is shown when user is logged in.\n' +
    'Favicon is shown on logout page',
  async (
    {
      baseAssertion,
      setTestIds,
      incognitoPage,
      incognitoAuth0Page,
      incognitoProviderLogin,
    },
    testInfo,
  ) => {
    setTestIds('EPMDIAL-2385', 'EPMDIAL-2384');
    const imageContentType = /^image\//;
    const username =
      process.env.E2E_USERNAME!.split(',')[
        dialTest.info().parallelIndex + +config.workers!
      ];
    let dialHomePage: DialHomePage;
    let favicon: Favicon;

    await dialTest.step(
      'Open login page and verify favicon request is triggered, icon is set in DOM',
      async () => {
        const { responses } = await incognitoAuth0Page.waitForExpectedResponses(
          () => incognitoProviderLogin.navigateToProviderStartPage(),
          [{ apiMethod: 'GET', urlPattern: API.faviconHost }],
        );
        baseAssertion.assertValueMatchPattern(
          responses[0].headers()['content-type'],
          imageContentType,
          ExpectedMessages.responseContentTypeIsImage,
        );
        baseAssertion.assertNumberIsGreaterThan(
          (await responses[0].text()).length,
          0,
        );
      },
    );

    await dialTest.step(
      'Log in DIAL and verify favicon response is received',
      async () => {
        await incognitoProviderLogin.navigateToCredentialsPage();
        await incognitoProviderLogin.authProviderLogin(
          testInfo,
          username,
          process.env.E2E_PASSWORD!,
          false,
        );
        dialHomePage = new DialHomePage(incognitoPage);
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
      },
    );

    await dialTest.step('Check that favicon is set in DOM', async () => {
      favicon = new Favicon(incognitoPage);
      await baseAssertion.assertElementAttribute(
        favicon,
        Attributes.href,
        API.faviconHost,
        ExpectedMessages.faviconUrlIsValid,
      );
    });

    await dialTest.step('Logout and verify favicon is set in DOM', async () => {
      const appContainer = dialHomePage.getAppContainer();
      const accountSettings = appContainer.getHeader().getAccountSettings();
      await accountSettings.logout();
      await baseAssertion.assertElementAttribute(
        favicon,
        Attributes.href,
        API.faviconHost,
        ExpectedMessages.faviconUrlIsValid,
      );
    });
  },
);
