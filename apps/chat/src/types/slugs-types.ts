import { SimpleApplicationStatus } from './applications';

export enum ServerSlugs {
  PUBLICATION_APPROVE = 'publication/approve',
  PUBLICATION_CREATE = 'publication/create',
  PUBLICATION_GET = 'publication/get',
  PUBLICATION_LIST = 'publication/list',
  PUBLICATION_REJECT = 'publication/reject',
  PUBLICATION_RULE_LIST = 'publication/rule/list',
  PUBLICATION_UPDATE = 'publication/update',
  RESOURCE_MOVE = 'resource/move',
  APPLICATION = 'application',
  APPLICATION_DEPLOY = `application/${SimpleApplicationStatus.DEPLOY}`,
  APPLICATION_UNDEPLOY = `application/${SimpleApplicationStatus.UNDEPLOY}`,
  APPLICATION_REDEPLOY = `application/${SimpleApplicationStatus.REDEPLOY}`,
  APPLICATION_LOGS = 'application/logs',
}
