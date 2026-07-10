import { ServerSlugs } from '@/src/types/slugs-types';

export const mappingServerUrls: Record<string, { response: boolean }> = {
  [ServerSlugs.PUBLICATION_APPROVE]: {
    response: false,
  },
  [ServerSlugs.PUBLICATION_CREATE]: {
    response: true,
  },
  [ServerSlugs.PUBLICATION_GET]: {
    response: true,
  },
  [ServerSlugs.PUBLICATION_LIST]: {
    response: true,
  },
  [ServerSlugs.PUBLICATION_REJECT]: {
    response: false,
  },
  [ServerSlugs.PUBLICATION_RULE_LIST]: {
    response: true,
  },
  [ServerSlugs.PUBLICATION_UPDATE]: {
    response: true,
  },
  [ServerSlugs.RESOURCE_MOVE]: {
    response: true,
  },
  [ServerSlugs.APPLICATION_DEPLOY]: {
    response: true,
  },
  [ServerSlugs.APPLICATION_UNDEPLOY]: {
    response: true,
  },
  [ServerSlugs.APPLICATION_REDEPLOY]: {
    response: true,
  },
  [ServerSlugs.APPLICATION_LOGS]: {
    response: true,
  },
  [ServerSlugs.TOOLSET_SIGN_IN]: {
    response: false,
  },
  [ServerSlugs.TOOLSET_SIGN_OUT]: {
    response: false,
  },
  [ServerSlugs.TOOLSET]: {
    response: true,
  },
};

export enum HeadersNames {
  CONTENT_SECURITY_POLICY = 'content-security-policy',
  X_DIAL_CLIENT_CHANNEL_ID = 'x-dial-client-channel-id',
}
