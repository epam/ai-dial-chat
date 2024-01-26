import { NextApiRequest } from 'next';

import { Conversation } from '@/src/types/chat';
import { Prompt } from '@/src/types/prompt';

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

export const getConversationKey = (conversation: Conversation) => {
  return [conversation.id, conversation.model.id, conversation.name].join(
    pathKeySeparator,
  );
};

export const getPromptKey = (prompt: Prompt) => {
  return [prompt.id, prompt.name].join(pathKeySeparator);
};
