import { GetServerSideProps } from 'next';
import { getToken } from 'next-auth/jwt';

import { isApplicationType } from '@/src/utils/app/application';
import { decrypt } from '@/src/utils/app/application-type-schema';
import { constructPath } from '@/src/utils/app/file';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import {
  ApiApplicationTypeSchema,
  ApiDetailedApplicationTypeSchema,
} from '@/src/types/application-type-schema';
import { ApiApplicationResponseDefault } from '@/src/types/applications';
import { DialAIError } from '@/src/types/error';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { GeneralInfoView } from '@/src/components/AppsEditor/GeneralInfoView/GeneralInfoView';

import { getLayout } from '../../_app';

interface PageProps {
  applicationData?: ApiApplicationResponseDefault;
  schema: ApiDetailedApplicationTypeSchema | null;
}

export default function AppsEditor({ applicationData, schema }: PageProps) {
  return (
    <div className="flex size-full flex-col">
      <AppsEditorHeader />
      <div className="flex size-full">
        <GeneralInfoView applicationData={applicationData} schema={schema} />
      </div>
    </div>
  );
}

AppsEditor.getLayout = getLayout;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const commonProps = await getCommonPageProps(context);
  if ('redirect' in commonProps || 'notFound' in commonProps) {
    return commonProps;
  }

  const token = await getToken({ req: context.req });

  if (!token?.access_token) {
    throw new Error('Failed to retrieve access token.');
  }

  const url = `${constructPath(
    process.env.DIAL_API_HOST,
    'v1',
    'application_type_schemas',
    'schemas',
  )}`;

  const response = await fetch(url, {
    headers: getApiHeaders({ jwt: token?.access_token as string }),
  });

  if (response.status === 404) {
    return {
      notFound: true,
    };
  } else if (!response.ok) {
    const serverErrorMessage = await response.text();
    throw new DialAIError(serverErrorMessage, '', '', response.status + '');
  }

  const json = (await response.json()) as ApiApplicationTypeSchema[];

  const schemas = json || [];
  const slug = context.params?.slug?.toString();

  if (!slug) {
    return {
      notFound: true,
    };
  }

  const schema = schemas.find((schema) => schema.$id === decrypt(slug));

  let applicationTypeDetailedSchema = null;

  if (schema) {
    const detailedSchemaUrl = `${constructPath(
      process.env.DIAL_API_HOST,
      'v1',
      'application_type_schemas',
      `schema?id=${schema.$id}`,
    )}`;

    const detailedSchemaResponse = await fetch(detailedSchemaUrl, {
      headers: getApiHeaders({ jwt: token.access_token }),
    });

    if (detailedSchemaResponse.status === 404) {
      return {
        notFound: true,
      };
    } else if (!detailedSchemaResponse.ok) {
      const serverErrorMessage = await detailedSchemaResponse.text();
      throw new DialAIError(
        serverErrorMessage,
        '',
        '',
        detailedSchemaResponse.status + '',
      );
    }

    applicationTypeDetailedSchema = await detailedSchemaResponse.json();
  }

  if (!isApplicationType(slug) && !applicationTypeDetailedSchema) {
    return {
      notFound: true,
    };
  }

  const { id } = context.query;

  if (id && typeof id === 'string') {
    try {
      const baseUrl = process.env.DIAL_API_HOST;
      const url = constructPath(baseUrl, 'v1', id);

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
          ...commonProps.props,
          applicationData,
          schema: applicationTypeDetailedSchema ?? null,
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
      props: {
        ...commonProps.props,
        schema: applicationTypeDetailedSchema,
      },
    };
  }
};
