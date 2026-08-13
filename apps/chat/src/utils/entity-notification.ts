import { CatalogEntityType } from '@epam/ai-dial-catalog';
import { EntityNotificationsI18nKeys } from '../constants/translation-keys';
import {
  EntityOperation,
  NotifiableEntity,
} from '../types/entity-notification';

/** i18n keys holding the complete title and body sentences of one operation notification. */
export interface OperationNotificationKeys {
  /** Key of the `<Entity> <operation> successfully` title. */
  titleKey: EntityNotificationsI18nKeys;
  /** Key of the body sentence naming the entity. */
  messageKey: EntityNotificationsI18nKeys;
}

/*
 * The single audit surface for operation notification copy: one entry per
 * (entity, operation) pair the product actually performs. `as const satisfies`
 * keeps the literal key sets, so `useOperationNotification` can reject a pair
 * that has no entry at compile time instead of notifying with `undefined` copy.
 */
export const ENTITY_OPERATION_NOTIFICATIONS = {
  [NotifiableEntity.Prompt]: {
    [EntityOperation.Created]: {
      titleKey: EntityNotificationsI18nKeys.PromptCreatedTitle,
      messageKey: EntityNotificationsI18nKeys.PromptCreated,
    },
    [EntityOperation.Edited]: {
      titleKey: EntityNotificationsI18nKeys.PromptEditedTitle,
      messageKey: EntityNotificationsI18nKeys.PromptEdited,
    },
    [EntityOperation.Deleted]: {
      titleKey: EntityNotificationsI18nKeys.PromptDeletedTitle,
      messageKey: EntityNotificationsI18nKeys.PromptDeleted,
    },
    [EntityOperation.Downloaded]: {
      titleKey: EntityNotificationsI18nKeys.PromptDownloadedTitle,
      messageKey: EntityNotificationsI18nKeys.PromptDownloaded,
    },
    [EntityOperation.PublishRequested]: {
      titleKey: EntityNotificationsI18nKeys.PromptPublishRequestedTitle,
      messageKey: EntityNotificationsI18nKeys.PromptPublishRequested,
    },
  },
  [NotifiableEntity.Agent]: {
    [EntityOperation.Created]: {
      titleKey: EntityNotificationsI18nKeys.AgentCreatedTitle,
      messageKey: EntityNotificationsI18nKeys.AgentCreated,
    },
    [EntityOperation.Edited]: {
      titleKey: EntityNotificationsI18nKeys.AgentEditedTitle,
      messageKey: EntityNotificationsI18nKeys.AgentEdited,
    },
    [EntityOperation.Deleted]: {
      titleKey: EntityNotificationsI18nKeys.AgentDeletedTitle,
      messageKey: EntityNotificationsI18nKeys.AgentDeleted,
    },
    [EntityOperation.PublishRequested]: {
      titleKey: EntityNotificationsI18nKeys.AgentPublishRequestedTitle,
      messageKey: EntityNotificationsI18nKeys.AgentPublishRequested,
    },
  },
  [NotifiableEntity.QuickApp]: {
    [EntityOperation.Created]: {
      titleKey: EntityNotificationsI18nKeys.QuickAppCreatedTitle,
      messageKey: EntityNotificationsI18nKeys.QuickAppCreated,
    },
    [EntityOperation.Edited]: {
      titleKey: EntityNotificationsI18nKeys.QuickAppEditedTitle,
      messageKey: EntityNotificationsI18nKeys.QuickAppEdited,
    },
    [EntityOperation.Deleted]: {
      titleKey: EntityNotificationsI18nKeys.QuickAppDeletedTitle,
      messageKey: EntityNotificationsI18nKeys.QuickAppDeleted,
    },
    [EntityOperation.PublishRequested]: {
      titleKey: EntityNotificationsI18nKeys.QuickAppPublishRequestedTitle,
      messageKey: EntityNotificationsI18nKeys.QuickAppPublishRequested,
    },
  },
  [NotifiableEntity.CustomApp]: {
    [EntityOperation.Created]: {
      titleKey: EntityNotificationsI18nKeys.CustomAppCreatedTitle,
      messageKey: EntityNotificationsI18nKeys.CustomAppCreated,
    },
    [EntityOperation.Edited]: {
      titleKey: EntityNotificationsI18nKeys.CustomAppEditedTitle,
      messageKey: EntityNotificationsI18nKeys.CustomAppEdited,
    },
    [EntityOperation.Deleted]: {
      titleKey: EntityNotificationsI18nKeys.CustomAppDeletedTitle,
      messageKey: EntityNotificationsI18nKeys.CustomAppDeleted,
    },
    [EntityOperation.PublishRequested]: {
      titleKey: EntityNotificationsI18nKeys.CustomAppPublishRequestedTitle,
      messageKey: EntityNotificationsI18nKeys.CustomAppPublishRequested,
    },
  },
  [NotifiableEntity.Toolset]: {
    [EntityOperation.Created]: {
      titleKey: EntityNotificationsI18nKeys.ToolsetCreatedTitle,
      messageKey: EntityNotificationsI18nKeys.ToolsetCreated,
    },
    [EntityOperation.Edited]: {
      titleKey: EntityNotificationsI18nKeys.ToolsetEditedTitle,
      messageKey: EntityNotificationsI18nKeys.ToolsetEdited,
    },
    [EntityOperation.Deleted]: {
      titleKey: EntityNotificationsI18nKeys.ToolsetDeletedTitle,
      messageKey: EntityNotificationsI18nKeys.ToolsetDeleted,
    },
    [EntityOperation.PublishRequested]: {
      titleKey: EntityNotificationsI18nKeys.ToolsetPublishRequestedTitle,
      messageKey: EntityNotificationsI18nKeys.ToolsetPublishRequested,
    },
  },
  [NotifiableEntity.Model]: {
    [EntityOperation.Deleted]: {
      titleKey: EntityNotificationsI18nKeys.ModelDeletedTitle,
      messageKey: EntityNotificationsI18nKeys.ModelDeleted,
    },
    [EntityOperation.PublishRequested]: {
      titleKey: EntityNotificationsI18nKeys.ModelPublishRequestedTitle,
      messageKey: EntityNotificationsI18nKeys.ModelPublishRequested,
    },
  },
  [NotifiableEntity.Skill]: {
    [EntityOperation.Deleted]: {
      titleKey: EntityNotificationsI18nKeys.SkillDeletedTitle,
      messageKey: EntityNotificationsI18nKeys.SkillDeleted,
    },
    [EntityOperation.PublishRequested]: {
      titleKey: EntityNotificationsI18nKeys.SkillPublishRequestedTitle,
      messageKey: EntityNotificationsI18nKeys.SkillPublishRequested,
    },
  },
  [NotifiableEntity.Conversation]: {
    [EntityOperation.Deleted]: {
      titleKey: EntityNotificationsI18nKeys.ConversationDeletedTitle,
      messageKey: EntityNotificationsI18nKeys.ConversationDeleted,
    },
    [EntityOperation.PublishRequested]: {
      titleKey: EntityNotificationsI18nKeys.ConversationPublishRequestedTitle,
      messageKey: EntityNotificationsI18nKeys.ConversationPublishRequested,
    },
    [EntityOperation.Renamed]: {
      titleKey: EntityNotificationsI18nKeys.ConversationRenamedTitle,
      messageKey: EntityNotificationsI18nKeys.ConversationRenamed,
    },
    [EntityOperation.Duplicated]: {
      titleKey: EntityNotificationsI18nKeys.ConversationDuplicatedTitle,
      messageKey: EntityNotificationsI18nKeys.ConversationDuplicated,
    },
  },
  [NotifiableEntity.File]: {
    [EntityOperation.Renamed]: {
      titleKey: EntityNotificationsI18nKeys.FileRenamedTitle,
      messageKey: EntityNotificationsI18nKeys.FileRenamed,
    },
    [EntityOperation.Downloaded]: {
      titleKey: EntityNotificationsI18nKeys.FileDownloadedTitle,
      messageKey: EntityNotificationsI18nKeys.FileDownloaded,
    },
  },
  [NotifiableEntity.Folder]: {
    [EntityOperation.Created]: {
      titleKey: EntityNotificationsI18nKeys.FolderCreatedTitle,
      messageKey: EntityNotificationsI18nKeys.FolderCreated,
    },
    [EntityOperation.Renamed]: {
      titleKey: EntityNotificationsI18nKeys.FolderRenamedTitle,
      messageKey: EntityNotificationsI18nKeys.FolderRenamed,
    },
    [EntityOperation.Downloaded]: {
      titleKey: EntityNotificationsI18nKeys.FolderDownloadedTitle,
      messageKey: EntityNotificationsI18nKeys.FolderDownloaded,
    },
  },
} as const satisfies Record<
  NotifiableEntity,
  Partial<Record<EntityOperation, OperationNotificationKeys>>
>;

/** Shape of {@link ENTITY_OPERATION_NOTIFICATIONS}, narrowed to the pairs that exist. */
export type EntityOperationNotifications =
  typeof ENTITY_OPERATION_NOTIFICATIONS;

/** Operations that have notification copy for `entity`. */
export type NotifiableOperation<TEntity extends NotifiableEntity> =
  keyof EntityOperationNotifications[TEntity];

/*
 * Entity kinds a `CatalogItem` can resolve to. Typing the resolver against this
 * subset — rather than the whole enum — keeps generic catalog handlers usable:
 * `NotifiableOperation` over the union yields the operations every catalog kind
 * supports (delete, publish), so passing e.g. `Downloaded` for a runtime-unknown
 * type stays a compile error while `NotifiableEntity.Prompt` literals still allow it.
 */
export type CatalogNotifiableEntity =
  | NotifiableEntity.Prompt
  | NotifiableEntity.Agent
  | NotifiableEntity.QuickApp
  | NotifiableEntity.CustomApp
  | NotifiableEntity.Toolset
  | NotifiableEntity.Model
  | NotifiableEntity.Skill;

const CATALOG_ENTITY_TO_NOTIFIABLE: Record<
  CatalogEntityType,
  CatalogNotifiableEntity
> = {
  [CatalogEntityType.Model]: NotifiableEntity.Model,
  [CatalogEntityType.Agent]: NotifiableEntity.Agent,
  [CatalogEntityType.Toolset]: NotifiableEntity.Toolset,
  [CatalogEntityType.Skill]: NotifiableEntity.Skill,
  [CatalogEntityType.Prompt]: NotifiableEntity.Prompt,
};

/** Minimal deployment shape needed to tell a quick app from a custom app. */
interface AgentDeployment {
  /** Set when the application is driven by an application schema, i.e. a quick app. */
  applicationTypeSchemaId?: string | null;
}

/**
 * Returns the notification entity kind for a catalog item. An `Agent` item is a
 * quick app when its deployment carries an application schema and a custom app
 * when it does not; without a resolved deployment the kind is unknown, so the
 * generic `Agent` copy is used rather than guessing.
 */
export const resolveCatalogItemEntity = (
  type: CatalogEntityType,
  deployment?: AgentDeployment,
): CatalogNotifiableEntity => {
  if (type !== CatalogEntityType.Agent)
    return CATALOG_ENTITY_TO_NOTIFIABLE[type];
  if (deployment == null) return NotifiableEntity.Agent;
  return deployment.applicationTypeSchemaId
    ? NotifiableEntity.QuickApp
    : NotifiableEntity.CustomApp;
};
