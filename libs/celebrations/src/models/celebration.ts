import type { ComponentType, ReactNode } from 'react';

/** Props the runtime passes to an event's decoration. */
export interface CelebrationDecorationProps {
  /** Plays a random enabled click scene of the event. */
  onActivate: () => void;
}

/** One scene of an event; its deadline includes all delayed departures. */
export interface CelebrationScene {
  /** Stable scene id, unique within its event. */
  id: string;
  /** Artwork rendered in the viewport layer while the scene plays. */
  Component: ComponentType;
  /** How long the scene stays mounted, in milliseconds. */
  durationMs: number;
  /** Key of the scene's notification message in the event's labels. */
  labelId: string;
}

/** A phrase that plays one of the event's scenes instead of being sent. */
export interface CelebrationSecretTrigger {
  /** Phrases that match the whole composer text, ignoring case and punctuation. */
  phrases: readonly string[];
  /** Phrase interpolated into notifications as `{{phrase}}`. */
  hintPhrase: string;
  /** Scenes the phrase may play. */
  sceneIds: readonly string[];
}

/** A compiled celebration event, loaded only when a host selects it. */
export interface CelebrationEvent {
  /** Stable event id, such as `halloween`. */
  id: string;
  /** Icon a host may show instead of its own logo while the event is active. */
  iconUrl?: string;
  /** Start-page decoration with the event's trigger. */
  Decoration: ComponentType<CelebrationDecorationProps>;
  /** Every scene the event can play. */
  scenes: readonly CelebrationScene[];
  /** Scenes a trigger click chooses from. */
  clickSceneIds: readonly string[];
  /** English default labels keyed by label id. */
  labels: Readonly<Record<string, string>>;
  /** Key of the notification title in `labels`. */
  titleLabelId: string;
  /** Decoration behaviors a host may switch off one by one. */
  decorBehaviors?: readonly string[];
  /** Optional secret phrase handled by `consumeSecretPhrase`. */
  secretTrigger?: CelebrationSecretTrigger;
}

/** Loads an event module; resolves to the module or the event itself. */
export type CelebrationEventLoader = () => Promise<
  { default: CelebrationEvent } | CelebrationEvent
>;

/** The notification a played scene asks the host to show. */
export interface CelebrationNotification {
  /** Notification title, from the event's title label. */
  title: string;
  /** Scene message with `{{phrase}}` already replaced. */
  message: string;
}

/** Host DOM hooks that interface-borrowing scenes may measure. */
export interface CelebrationAnchors {
  /** Class name of the composer wrapper. */
  composer?: string;
  /** Class name of the composer's add/attach cluster. */
  composerAddCluster?: string;
  /** Class name of the composer's model selector button. */
  composerModelSelector?: string;
  /** Class name of the starter prompts list. */
  starterList?: string;
  /** Class name of the conversation-history container. */
  historyContainer?: string;
  /** Selector of a conversation link inside the history; its list item is the row. */
  historyRowLink?: string;
  /** Selector of the start-page region around the composer. Default: its closest `[role="region"]`. */
  welcomeRegion?: string;
}

/** Which scenes and decoration behaviors of one event a host allows. */
export interface CelebrationEventSelection {
  /** When set, only these scenes may play. */
  enabledScenes?: readonly string[];
  /** Scenes that never play. */
  disabledScenes?: readonly string[];
  /** Decoration behaviors that never start. */
  disabledDecorBehaviors?: readonly string[];
  /** Whether the secret phrase is handled. Default: `true`. */
  isSecretEnabled?: boolean;
}

/** Props of `CelebrationProvider`; every host concern arrives here. */
export interface CelebrationProviderProps {
  /** Children rendered inside the provider. */
  children: ReactNode;
  /** Event loaders keyed by event id. */
  events: Readonly<Record<string, CelebrationEventLoader>>;
  /** Event to show, or `null` for none. */
  activeEventId: string | null;
  /** Any value whose change cancels the active scene and reloads the event. */
  resetKey?: unknown;
  /** Label overrides keyed by event id, merged over the event's defaults; `undefined` keeps a default. */
  labels?: Readonly<
    Record<string, Readonly<Record<string, string | undefined>>>
  >;
  /** Called once per played scene with its resolved notification. */
  onNotify?: (notification: CelebrationNotification) => void;
  /** Whether the host currently uses its mobile layout. Default: `false`. */
  isMobile?: boolean;
  /** Host DOM hooks for interface-borrowing scenes. */
  anchors?: CelebrationAnchors;
  /** Per-event scene and decoration selection keyed by event id. */
  selection?: Readonly<Record<string, CelebrationEventSelection>>;
  /** Element scenes render into. Default: `document.body`. */
  portalContainer?: Element;
}

/** What `useCelebration` returns. */
export interface CelebrationContextValue {
  /** The loaded, selected event, or `null`. */
  event: CelebrationEvent | null;
  /** Whether an event is loaded and shown. */
  isEnabled: boolean;
  /** Plays the scene with this id when it exists and is enabled. */
  celebrate: (sceneId: string) => void;
  /** Plays a random enabled click scene. */
  activate: () => void;
  /** Plays a secret scene when the text matches the event's phrase; returns whether it did. */
  consumeSecretPhrase: (text: string) => boolean;
}
