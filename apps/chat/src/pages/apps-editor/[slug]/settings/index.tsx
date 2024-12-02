import { useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { getToken } from 'next-auth/jwt';
import { useRouter } from 'next/router';

import { constructPath } from '@/src/utils/app/file';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import {
  ApplicationSlug,
  CustomApplicationModel,
} from '@/src/types/applications';

import {
  AppsEditorHeader,
  TabKeys,
} from '@/src/components/AppsEditor/AppsEditorHeader';
import { MindmapView } from '@/src/components/AppsEditor/Settings/MindmapView';

import { getLayout } from '../../../_app';

interface PageProps {
  applicationData: CustomApplicationModel;
  currentProviderId: string;
}

export default function AppsSettings({
  applicationData,
  currentProviderId,
}: PageProps) {
  const router = useRouter();
  const appType = useMemo(
    () => router.query.slug?.toString(),
    [router.query.slug],
  );

  const getView = (appSlug?: string) => {
    switch (appSlug) {
      // case ApplicationSlug.CODE_APP:
      //   return <CodeAppView isEdit={false} />;
      // case ApplicationSlug.CUSTOM_APP:
      // return <CustomAppView isEdit={false} />;
      case ApplicationSlug.MINDMAP_APP:
        return (
          <MindmapView
            id={applicationData.name}
            currentProviderId={currentProviderId}
          />
        );
      default:
        return <pre>{JSON.stringify(applicationData, null, 2)}</pre>;
    }
  };

  return (
    <div className="flex size-full flex-col">
      <AppsEditorHeader activeTab={TabKeys.SETTINGS} />
      <div className="flex size-full">{getView(appType)}</div>
    </div>
  );
}

AppsSettings.getLayout = getLayout;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const commonProps = await getCommonPageProps(context);
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

      return {
        props: {
          ...commonProps,
          applicationData,
          currentProviderId: token.providerId,
        },
      };
    } catch (error) {
      logger.error('Error fetching application data:', error);
      return {
        notFound: true,
      };
    }
  }

  return {
    notFound: true,
  };
};
