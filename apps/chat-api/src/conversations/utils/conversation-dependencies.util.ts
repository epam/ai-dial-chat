import {
  collectDependencies,
  isResourceInBucket,
} from '../../publish/dependencies/publish-dependency.util';
import type { ResourceDependencyDto } from '../../publish/dto/resource-dependency.dto';
import { collectConversationAttachmentUrls } from './conversation-attachments.util';

const DEPLOYMENT_PREFIXES = ['applications/', 'toolsets/'];
const SKILL_PREFIX = 'skills/';
const FILE_PREFIXES = ['files/', 'metadata/files/'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const startsWithAny = (value: string, prefixes: string[]): boolean =>
  prefixes.some((prefix) => value.startsWith(prefix));

/**
 * The deployment ids a conversation runs on: its model, the assistant model
 * and the enabled add-ons. A built-in model or a config-defined application
 * is a bare id and is never a dependency; only a resource url can be one.
 * @param conversation - a stored conversation body
 */
const collectDeploymentRefs = (conversation: Record<string, unknown>) => {
  const model = isRecord(conversation.model)
    ? conversation.model.id
    : undefined;
  const addons = Array.isArray(conversation.selectedAddons)
    ? conversation.selectedAddons
    : [];
  return [model, conversation.assistantModelId, ...addons].filter(
    (id): id is string =>
      typeof id === 'string' && startsWithAny(id, DEPLOYMENT_PREFIXES),
  );
};

/**
 * The skill urls the conversation's messages ask DIAL Core to use.
 * @param conversation - a stored conversation body
 */
const collectSkillRefs = (conversation: Record<string, unknown>): string[] => {
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages
    : [];
  const urls: string[] = [];
  for (const message of messages) {
    const skills =
      isRecord(message) && isRecord(message.custom_content)
        ? message.custom_content.skills
        : undefined;
    if (!Array.isArray(skills)) continue;
    for (const skill of skills) {
      if (
        isRecord(skill) &&
        typeof skill.url === 'string' &&
        skill.url.startsWith(SKILL_PREFIX)
      ) {
        urls.push(skill.url);
      }
    }
  }
  return urls;
};

/**
 * The attachment files and folders that belong to someone else. Files in the
 * author's own bucket are published with the conversation and are skipped; a
 * file in the public bucket needs nothing. Inline data, external urls and
 * references only found in `playback` / `replay` stacks are never collected.
 * @param conversation - a stored conversation body
 * @param bucket - the author's own bucket
 */
const collectForeignFileRefs = (
  conversation: Record<string, unknown>,
  bucket: string,
): string[] =>
  collectConversationAttachmentUrls(conversation).filter(
    (url) =>
      startsWithAny(url, FILE_PREFIXES) && !isResourceInBucket(url, bucket),
  );

/**
 * The direct dependencies of a stored conversation that are not in the public
 * bucket and that publishing the conversation does not carry along.
 * @param conversation - a stored conversation body
 * @param bucket - the author's own bucket
 */
export const collectConversationDependencies = (
  conversation: unknown,
  bucket: string,
): ResourceDependencyDto[] => {
  if (!isRecord(conversation)) return [];
  return collectDependencies([
    ...collectDeploymentRefs(conversation),
    ...collectSkillRefs(conversation),
    ...collectForeignFileRefs(conversation, bucket),
  ]);
};
