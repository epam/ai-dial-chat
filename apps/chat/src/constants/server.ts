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
};
