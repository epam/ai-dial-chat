import { JSX, useMemo } from 'react';

import { GetServerSideProps } from 'next';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

import { useTranslation } from '@/src/hooks/useTranslation';

import { constructPath } from '@/src/utils/app/file';
import { getThemeIconUrl } from '@/src/utils/app/themes';
import { getQueryParameterCaseInsensitive } from '@/src/utils/app/url/query-params';

import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { DialNeutralButton } from '@epam/ai-dial-ui-kit';

/**
 * The following errors are passed as error query parameters to the default or overridden error page.
 *
 * [Documentation](https://next-auth.js.org/configuration/pages#error-page) */
export type ErrorType =
  | 'default'
  | 'configuration'
  | 'accessdenied'
  | 'verification';

interface ErrorView {
  status: number;
  heading: string;
  message: JSX.Element;
}

interface PageProps {
  themesHostDefined: boolean;
}

/** Renders an error page. */
export default function ErrorPage({ themesHostDefined }: PageProps) {
  const { t } = useTranslation(Translation.Common);

  const searchParams = useSearchParams();
  const errorType = getQueryParameterCaseInsensitive(
    searchParams,
    'error',
    'default',
  );
  const signinPageUrl = `/auth/signin`;

  const errors: Record<ErrorType, ErrorView> = {
    default: {
      status: 200,
      heading: 'Error',
      message: (
        <>
          <DialNeutralButton
            onClick={() => window.location.assign('/')}
            label={t(CommonI18nKeys.BackToMainPage)}
          />
        </>
      ),
    },
    configuration: {
      status: 500,
      heading: 'Server error',
      message: (
        <>
          <p>{t(CommonI18nKeys.ServerConfigProblem)}</p>
          <p>{t(CommonI18nKeys.CheckServerLogs)}</p>
        </>
      ),
    },
    accessdenied: {
      status: 403,
      heading: 'Access Denied',
      message: (
        <>
          <div>{t(CommonI18nKeys.NoPermissionToSignIn)}</div>
          <DialNeutralButton
            onClick={() => window.location.assign(signinPageUrl)}
            label={t(CommonI18nKeys.SignIn)}
          />
        </>
      ),
    },
    verification: {
      status: 403,
      heading: 'Unable to sign in',
      message: (
        <>
          <p>{t(CommonI18nKeys.SignInLinkNoLongerValid)}</p>
          <p>{t(CommonI18nKeys.SignInLinkMayHaveBeenUsed)}</p>
          <DialNeutralButton
            onClick={() => window.location.assign(signinPageUrl)}
            label={t(CommonI18nKeys.SignIn)}
          />
        </>
      ),
    },
  };

  const { heading, message } =
    errorType && typeof errorType === 'string'
      ? (errors[errorType.toLowerCase() as ErrorType] ?? errors.default)
      : errors.default;

  const logoImgSrc = useMemo(() => {
    if (themesHostDefined) {
      return constructPath(
        process.env.APP_BASE_PATH || '',
        getThemeIconUrl('favicon'),
      );
    }
  }, [themesHostDefined]);

  return (
    <div className="flex size-full h-screen flex-col items-center overflow-auto bg-auth-layer-0">
      <div className="shrink grow"></div>
      <div className="my-1 h-fit w-[320px] shrink-0 grow-0 rounded bg-auth-layer-1 p-6">
        <div className="mb-6 flex justify-center">
          {!!logoImgSrc && (
            <Image src={logoImgSrc} alt="Brand" width={70} height={70} />
          )}
        </div>
        <h1 className="my-4 text-center text-xl font-semibold">{heading}</h1>
        <div className="flex flex-col gap-4 text-center text-sm">{message}</div>
      </div>
      <div className="shrink grow"></div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader('Cache-Control', 'no-store');

  if (
    !process.env.ALLOW_OPEN_SIGNIN_PAGE_IN_IFRAME ||
    process.env.ALLOW_OPEN_SIGNIN_PAGE_IN_IFRAME === 'false'
  ) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  const themesHostDefined = !!process.env.THEMES_CONFIG_HOST;

  return {
    props: {
      themesHostDefined,
    },
  };
};
