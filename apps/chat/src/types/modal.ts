export enum ModalState {
  CLOSED = 'CLOSED',
  LOADING = 'LOADING',
  OPENED = 'OPENED',
}

export type OnItemEvent = (actionOption: string, entityId: unknown) => void;
