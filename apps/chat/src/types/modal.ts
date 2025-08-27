import { FolderInterface } from '@/src/types/folder';
import { SharingType } from '@/src/types/share';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';

export enum ModalState {
  CLOSED = 'CLOSED',
  LOADING = 'LOADING',
  OPENED = 'OPENED',
}

export type OnItemEvent = (actionOption: string, entityId: unknown) => void;

export interface PublicationFolderPayload {
  entity: FolderInterface;
  entities: ShareEntity[];
  type: SharingType;
  action: PublishActions;
}
