import { DocumentProps, Head, Html, Main, NextScript } from 'next/document';
import Script from 'next/script';

import { isRtlLocale } from '@/src/utils/app/rtl';
import { getAdditionalCssFilenames } from '@/src/utils/server/additional-css';

import i18nextConfig from '@/next-i18next.config';
import { documentWithJss } from '@epam/ai-dial-modulify-ui';

type Props = DocumentProps & {
  //
};

function Document(props: Props) {
  const currentLocale =
    props.__NEXT_DATA__.locale ?? i18nextConfig.i18n.defaultLocale;

  const dir = isRtlLocale(currentLocale) ? 'rtl' : 'ltr';
  const additionalCssFiles = getAdditionalCssFilenames();

  return (
    <Html lang={currentLocale} dir={dir}>
      <Head nonce={props.nonce}>
        {!!process.env.APP_BASE_ORIGIN && !!process.env.APP_BASE_PATH && (
          <base
            href={`${process.env.APP_BASE_ORIGIN}${process.env.APP_BASE_PATH}/`}
          ></base>
        )}

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-title"
          content={process.env.NEXT_PUBLIC_APP_NAME || 'DIAL'}
        ></meta>
        {!!process.env.THEMES_CONFIG_HOST && (
          <link rel="stylesheet" href={'/api/themes/styles'} />
        )}
        {additionalCssFiles.map((file) => (
          <link
            key={file}
            rel="stylesheet"
            href={`/api/additional-css/${file}`}
          />
        ))}
        <link rel="manifest" href="/api/manifest" />
      </Head>
      <body>
        <Script
          nonce={props.nonce}
          id="theme-script"
          strategy="beforeInteractive"
          src="/scripts/theme-loader.js"
          type="text/javascript"
        />

        <Main />
        <NextScript nonce={props.nonce} />
      </body>
    </Html>
  );
}

export default documentWithJss(Document);
