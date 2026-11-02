import type { CatalogItem } from '@epam/ai-dial-catalog';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import { getApiErrorDetails } from '../../api-error/api-error';
import { parseSkillResourceUrl } from '../../skill/skill-types';

/** A host notification `useCatalogItemDelete` asks to be shown for a failed delete. */
export interface CatalogItemDeleteNotification {
  /** Localized error message. */
  message: string;
  /** Trace id of the failed request, when the API returned one. */
  requestId?: string;
}

/** Parameters accepted by {@link useCatalogItemDelete}. */
export interface UseCatalogItemDeleteParams {
  /** Already-configured DIAL Core operation: deletes a personal or shared prompt. */
  deletePrompt: (id: string) => Promise<unknown>;
  /** Already-configured DIAL Core operation: deletes a toolset. */
  deleteToolset: (id: string) => Promise<unknown>;
  /** Already-configured DIAL Core operation: deletes a skill package. */
  deleteSkill: (bucket: string, path: string) => Promise<unknown>;
  /** Already-configured DIAL Core operation: deletes a deployment/application. */
  deleteApplication: (id: string) => Promise<unknown>;
  /** Refetches the prompt listing after a prompt is deleted. */
  refetchPrompts: () => Promise<void>;
  /** Refetches the toolset listing after a toolset is deleted. */
  refetchToolsets: () => Promise<void>;
  /** Refetches the skill listing after a skill is deleted. */
  refetchSkills: () => Promise<void>;
  /** Refetches the deployment listing after an application is deleted. */
  refetchDeployments: () => Promise<void>;
  /** Called after a successful delete, so the host can notify with its own entity/operation vocabulary. */
  onDeleteSuccess: (item: CatalogItem) => void;
  /** Localized message shown when a delete fails. */
  deleteErrorLabel: string;
  /** Called to surface a host notification when a delete fails. */
  onNotify: (notification: CatalogItemDeleteNotification) => void;
}

/**
 * Returns a delete handler that removes a catalog item through the endpoint
 * its type owns, refetches that listing and reports success; on failure it
 * notifies with the request's trace id and rethrows, so a confirmation stays
 * open.
 */
export const useCatalogItemDelete = ({
  deletePrompt,
  deleteToolset,
  deleteSkill,
  deleteApplication,
  refetchPrompts,
  refetchToolsets,
  refetchSkills,
  refetchDeployments,
  onDeleteSuccess,
  deleteErrorLabel,
  onNotify,
}: UseCatalogItemDeleteParams): ((item: CatalogItem) => Promise<void>) =>
  useCallback(
    async (item: CatalogItem) => {
      try {
        if (item.type === CatalogEntityType.Prompt) {
          await deletePrompt(item.id);
          await refetchPrompts();
        } else if (item.type === CatalogEntityType.Toolset) {
          await deleteToolset(item.id);
          await refetchToolsets();
        } else if (item.type === CatalogEntityType.Skill) {
          const parsed = parseSkillResourceUrl(item.id);
          if (parsed == null) {
            throw new Error(`Invalid skill resource url: ${item.id}`);
          }
          await deleteSkill(parsed.bucket, parsed.path);
          await refetchSkills();
        } else {
          await deleteApplication(item.id);
          await refetchDeployments();
        }

        onDeleteSuccess(item);
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        onNotify({ message: deleteErrorLabel, requestId: traceId });
        throw err;
      }
    },
    [
      deletePrompt,
      deleteToolset,
      deleteSkill,
      deleteApplication,
      refetchPrompts,
      refetchToolsets,
      refetchSkills,
      refetchDeployments,
      onDeleteSuccess,
      deleteErrorLabel,
      onNotify,
    ],
  );
