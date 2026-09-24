import type { ParseKeys } from 'i18next';
import type { ComponentType } from 'react';

/** Decorations receive behavior from the application-owned runtime. */
export interface CelebrationDecorationProps {
  onActivate: () => void;
}

/** One already-loaded scene; its deadline includes all delayed departures. */
export interface CelebrationScene {
  id: string;
  Component: ComponentType;
  durationMs: number;
  notificationKey: ParseKeys;
}

/** A compiled event module, loaded only when selected on the start page. */
export interface CelebrationEvent {
  id: string;
  iconUrl?: string;
  Decoration: ComponentType<CelebrationDecorationProps>;
  scenes: readonly CelebrationScene[];
  clickSceneIds: readonly string[];
  notificationTitleKey: ParseKeys;
  secretTrigger?: {
    phrases: readonly string[];
    hintPhrase: string;
    sceneId: string;
  };
}
