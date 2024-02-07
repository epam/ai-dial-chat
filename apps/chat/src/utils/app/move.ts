import { DragEvent } from 'react';

import { FeatureType } from '@/src/types/common';

import { emptyImage } from '@/src/constants/drag-and-drop';

export enum MoveType {
  Conversation = 'conversation',
  ConversationFolder = 'conversations_folder',
  Prompt = 'prompt',
  PromptFolder = 'prompts_folder',
  File = 'file',
  FileFolder = 'files_folder',
}

export const getFolderMoveType = (featureType?: FeatureType): MoveType => {
  switch (featureType) {
    case FeatureType.Chat:
      return MoveType.ConversationFolder;
    case FeatureType.Prompt:
      return MoveType.PromptFolder;
    default:
      return MoveType.FileFolder;
  }
};

export const getEntityMoveType = (featureType?: FeatureType): MoveType => {
  switch (featureType) {
    case FeatureType.Chat:
      return MoveType.Conversation;
    case FeatureType.Prompt:
      return MoveType.Prompt;
    default:
      return MoveType.File;
  }
};

export const hasDragEventEntityData = (
  event: DragEvent,
  featureType?: FeatureType,
): boolean => {
  return (
    event.dataTransfer?.types.includes(getEntityMoveType(featureType)) ?? false
  );
};

export const hasDragEventFolderData = (
  event: DragEvent,
  featureType?: FeatureType,
): boolean => {
  return (
    event.dataTransfer?.types.includes(getFolderMoveType(featureType)) ?? false
  );
};

export const hasDragEventAnyData = (
  event: DragEvent,
  featureType?: FeatureType,
): boolean => {
  return (
    hasDragEventEntityData(event, featureType) ||
    hasDragEventFolderData(event, featureType)
  );
};

let _dragImage: HTMLImageElement;

export const getDragImage = () => {
  if (!_dragImage) {
    _dragImage = document.createElement('img');
    _dragImage.src = emptyImage;
  }
  return _dragImage;
};
