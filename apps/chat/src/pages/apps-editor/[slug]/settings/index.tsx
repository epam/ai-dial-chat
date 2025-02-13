import { useEffect, useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { getToken } from 'next-auth/jwt';
import { useRouter } from 'next/router';

import { isApplicationType } from '@/src/utils/app/application';
import { decode } from '@/src/utils/app/application-type-schema';
import { constructPath } from '@/src/utils/app/file';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { ApiApplicationResponseDefault } from '@/src/types/applications';
import { Conversation } from '@/src/types/chat';
import { DialAIError } from '@/src/types/error';

import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.reducer';
import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { ApplicationSettings } from '@/src/components/AppsEditor/Settings';

import { getLayout } from '../../../_app';

import fetch from 'node-fetch';

interface PageProps {
  applicationData: ApiApplicationResponseDefault;
  previewConversationId: string | null;
}

export default function AppsSettings({
  applicationData,
  previewConversationId,
}: PageProps) {
  const dispatch = useAppDispatch();
  const {
    query: { slug = '' },
  } = useRouter();
  const type = useMemo(
    () =>
      isApplicationType(slug.toString())
        ? slug.toString()
        : decode(slug?.toString() ?? ''),
    [slug],
  );

  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const isSchemaApplicationType = !isApplicationType(decode(slug.toString()));

  useEffect(() => {
    dispatch(
      ConversationsActions.setPreviewConversationId(previewConversationId),
    );
  }, [dispatch, previewConversationId]);

  return (
    <div className="flex size-full flex-col">
      <AppsEditorHeader
        isEditApplication
        applicationTypeDisplayName={
          isSchemaApplicationType
            ? (schema?.['dial:applicationTypeDisplayName'] ?? '')
            : decode(slug.toString())
        }
      />
      <div className="flex size-full grow overflow-hidden">
        <ApplicationSettings
          applicationData={applicationData}
          schema={isSchemaApplicationType ? schema : null}
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

      const conversationsData = (await conversationsResponse.json()) as {
        items: { url: string; isApplicationPreviewConversation?: boolean }[];
      };
      const filteredConversations = conversationsData.items.filter((item) =>
        item.url.includes(applicationData.reference),
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
            const conversationDetailed =
              (await conversation.json()) as Conversation;
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
