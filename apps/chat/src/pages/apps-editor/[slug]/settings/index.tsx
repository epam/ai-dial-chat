import { useEffect, useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { getToken } from 'next-auth/jwt';
import { useRouter } from 'next/router';

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

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { ApplicationSettings } from '@/src/components/AppsEditor/Settings';

import { getLayout } from '../../../_app';

import fetch from 'node-fetch';

interface PageProps {
  applicationData: ApiApplicationResponseDefault;
  previewConversationId: string | null;
  schema: ApiDetailedApplicationTypeSchema | null;
}

export default function AppsSettings({
  applicationData,
  previewConversationId,
  schema,
}: PageProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const type = useMemo(
    () =>
      isApplicationType(router.query.slug?.toString())
        ? router.query.slug?.toString()
        : decrypt(router.query.slug?.toString() ?? ''),
    [router.query.slug],
  );

  useEffect(() => {
    dispatch(
      ConversationsActions.setPreviewConversationId(previewConversationId),
    );
  }, [dispatch, previewConversationId]);

  return (
    <div className="flex size-full flex-col">
      <AppsEditorHeader />
      <div className="flex size-full grow overflow-hidden">
        <ApplicationSettings
          applicationData={applicationData}
          schema={schema}
          type={type ?? ''}
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

  const schema = schemas.find((schema) => {
    return schema.$id.replace(/^https?:\/\//, '') === decrypt(slug);
  });

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

  if (
    !isApplicationType(decodeURIComponent(slug)) &&
    !applicationTypeDetailedSchema
  ) {
    return {
      notFound: true,
    };
  }

  const { id } = context.query;

  if (id && typeof id === 'string') {
    try {
      const applicationId = decodeURIComponent(id);
      const baseUrl = process.env.DIAL_API_HOST;
      const paths = applicationId.split('/').map(encodeURIComponent);
      const url = constructPath(baseUrl, 'v1', ...paths);

      const response = await fetch(url, {
        method: 'GET',
        headers: getApiHeaders({ jwt: token.access_token }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch application data: ${response.status} ${response.statusText}`,
        );
      }

      const applicationData =
        (await response.json()) as ApiApplicationResponseDefault;

      const bucketUrl = `${process.env.DIAL_API_HOST}/v1/bucket`;
      const bucketResponse = await fetch(bucketUrl, {
        headers: getApiHeaders({ jwt: token?.access_token as string }),
      });

      if (!bucketResponse.ok) {
        const serverErrorMessage = await bucketResponse.text();
        throw new DialAIError(
          serverErrorMessage,
          '',
          '',
          bucketResponse.status + '',
        );
      }

      const json = (await bucketResponse.json()) as { bucket: string };

      const bucket = json.bucket;

      const conversationsUrl = `${constructPath(
        process.env.DIAL_API_HOST,
        'v1/metadata',
        'conversations',
        bucket,
      )}/?limit=1000&recursive=true`;

      const conversationsResponse = await fetch(conversationsUrl, {
        headers: getApiHeaders({ jwt: token.access_token }),
      });

      if (!conversationsResponse.ok) {
        throw new Error(
          `Failed to fetch conversations data: ${conversationsResponse.status} ${conversationsResponse.statusText}`,
        );
      }

      const conversationsData = (await conversationsResponse.json()) as any;
      const filteredConversations = conversationsData.items.filter(
        (item: { url: string }) => item.url.includes(applicationData.reference),
      );

      const applicationConversations = await Promise.all(
        filteredConversations.map(async (item: { url: string }) => {
          const detailedConversationsUrl = `${constructPath(
            process.env.DIAL_API_HOST,
            'v1',
            item.url,
          )}`;
          try {
            const conversation = await fetch(detailedConversationsUrl, {
              headers: getApiHeaders({ jwt: token.access_token }),
            });
            const conversationDetailed = await conversation.json();
            return conversationDetailed;
          } catch (error) {
            logger.error('Error fetching conversation data:', error);
            return null;
          }
        }),
      );

      const previewConversation = applicationConversations.find(
        (conversation) => conversation?.isApplicationPreviewConversation,
      );

      return {
        props: {
          ...commonProps.props,
          applicationData,
          previewConversationId: previewConversation?.id ?? null,
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
      notFound: true,
    };
  }
};
