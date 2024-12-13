import { useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { getToken } from 'next-auth/jwt';
import { useRouter } from 'next/router';

import { isApplicationType } from '@/src/utils/app/application';
import { constructPath } from '@/src/utils/app/file';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import {
  ApiApplicationResponseDefault,
  ApplicationSlug,
} from '@/src/types/applications';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { ApplicationSettings } from '@/src/components/AppsEditor/Settings';

import { getLayout } from '../../../_app';

interface PageProps {
  applicationData: ApiApplicationResponseDefault;
  currentProviderId: string;
  frontendHost: string | null;
}

export default function AppsSettings({
  applicationData,
  currentProviderId,
  frontendHost,
}: PageProps) {
  const router = useRouter();
  const appType = useMemo(
    () => router.query.slug?.toString(),
    [router.query.slug],
  );

  return (
    <div className="flex size-full flex-col">
      <AppsEditorHeader />
      <div className="flex size-full grow overflow-hidden">
        <ApplicationSettings
          currentProviderId={currentProviderId}
          type={appType as ApplicationSlug}
          applicationData={applicationData}
          frontendHost={frontendHost}
        />
      </div>
    </div>
  );
}

AppsSettings.getLayout = getLayout;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const commonProps = await getCommonPageProps(context);
  if ('redirect' in commonProps || 'notFound' in commonProps) {
    return commonProps;
  }

  const { id } = context.query;

  if (id && typeof id === 'string') {
    try {
      const baseUrl = process.env.DIAL_API_HOST || '';
      const url = constructPath(baseUrl, 'v1', id);
      const token = await getToken({ req: context.req });

      if (!token?.access_token) {
        throw new Error('Failed to retrieve access token.');
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: getApiHeaders({ jwt: token.access_token }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch application data: ${response.status} ${response.statusText}`,
        );
      }

      const applicationData = await response.json();

      const getApplicationFrontendHost = (type: string) => {
        const hosts: Record<ApplicationSlug, string | null> = {
          [ApplicationSlug.MINDMAP_APP]: process.env.MINDMAP_APPS_HOST ?? null,
          [ApplicationSlug.CODE_APP]: null,
          [ApplicationSlug.QUICK_APP]: null,
          [ApplicationSlug.CUSTOM_APP]: null,
        };
        if (isApplicationType(type)) {
          return hosts[type] ?? null;
        }
        return null;
      };

      const host = getApplicationFrontendHost(
        context.params?.slug?.toString() ?? '',
      );

      return {
        props: {
          ...commonProps.props,
          applicationData,
          currentProviderId: token.providerId,
          frontendHost: host,
        },
      };
    } catch (error) {
      logger.error('Error fetching application data:', error);
      return {
        notFound: true,
      };
    }
  } else {
    return {
      notFound: true,
    };
  }
};
