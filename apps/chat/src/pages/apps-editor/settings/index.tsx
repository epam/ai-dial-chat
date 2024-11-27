import { GetServerSideProps } from 'next';
import { getToken } from 'next-auth/jwt';

import { constructPath } from '@/src/utils/app/file';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';

import { getLayout } from '../../_app';

interface PageProps {
  applicationData: object | null;
}

export default function AppsSettings({ applicationData }: PageProps) {
  return (
    <div className="flex size-full flex-col">
      <AppsEditorHeader />
      <div className="flex size-full">
        <pre>{JSON.stringify(applicationData, null, 2)}</pre>
      </div>
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
