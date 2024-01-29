import { NextApiRequest } from 'next';



import { Conversation, ConversationInfo } from '@/src/types/chat';
import { Prompt, PromptInfo } from '@/src/types/prompt';



import { OpenAIError } from './types';


export enum ApiKeys {
  Files = 'files',
  Conversations = 'conversations',
  Prompts = 'prompts',
}

export const isValidEntityApiType = (apiKey: string) => {
  return Object.values(ApiKeys).includes(apiKey as ApiKeys);
};

export const getEntityTypeFromPath = (req: NextApiRequest) => {
  return Array.isArray(req.query.entitytype) ? '' : req.query.entitytype;
};

export const getEntityUrlFromSlugs = (
  dialApiHost: string,
  req: NextApiRequest,
) => {
  const entityType = getEntityTypeFromPath(req);
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  if (!slugs || slugs.length === 0) {
    throw new OpenAIError(`No ${entityType} path provided`, '', '', '400');
  }

  return `${dialApiHost}/v1/${encodeURI(slugs.join('/'))}`;
};

const pathKeySeparator = '__';

enum PseudoModel {
  Replay = 'replay',
  Playback = 'playback',
}

const getModelApiIdFromConversation = (conversation: Conversation) => {
  if (conversation.replay.isReplay) return PseudoModel.Replay;
  if (conversation.playback?.isPlayback) return PseudoModel.Playback;
  return conversation.model.id;
};

// Format key: {id:guid}__{modelId}__{name:base64}
export const getConversationApiKeyFromConversation = (
  conversation: Conversation,
) => {
  return [
    conversation.id,
    getModelApiIdFromConversation(conversation),
    btoa(conversation.name),
  ].join(pathKeySeparator);
};

// Format key: {id:guid}__{modelId}__{name:base64}
export const getConversationApiKeyFromConversationInfo = (
  conversation: ConversationInfo,
) => {
  return [conversation.id, conversation.modelId, btoa(conversation.name)].join(
    pathKeySeparator,
  );
};

// Format key: {id:guid}__{modelId}__{name:base64}
export const parseConversationApiKey = (apiKey: string): ConversationInfo => {
  const parts = apiKey.split(pathKeySeparator);

  if (parts.length !== 3) throw new Error('Incorrect conversation key');

  const [id, modelId, encodedName] = parts;

  return {
    id,
    modelId,
    name: atob(encodedName),
    isPlayback: modelId === PseudoModel.Playback,
    isReplay: modelId === PseudoModel.Replay,
  };
};

// Format key: {id:guid}__{name:base64}
export const getPromptApiKey = (prompt: PromptInfo) => {
  return [prompt.id, btoa(prompt.name)].join(pathKeySeparator);
};

// Format key: {id:guid}__{name:base64}
export const parsePromptApiKey = (apiKey: string): PromptInfo => {
  const parts = apiKey.split(pathKeySeparator);

  if (parts.length !== 2) throw new Error('Incorrect conversation key');

  const [id, encodedName] = parts;

  return {
    id,
    name: atob(encodedName),
  };
};
