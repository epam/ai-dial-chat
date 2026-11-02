import { createElement, type ComponentType, type FC } from 'react';
import { LottieScene } from '../components/LottieScene/LottieScene';
import {
  STATIC_TRIGGER_DEFAULT_LABEL,
  StaticTriggerDecoration,
} from '../components/StaticTriggerDecoration/StaticTriggerDecoration';
import { useCelebrationEnvironment } from '../context/CelebrationEnvironmentContext';
import type {
  CelebrationDecorationProps,
  CelebrationEvent,
  CelebrationScene,
} from '../models/celebration';
import type {
  CelebrationAssetLoaders,
  CelebrationPackDescriptor,
  CelebrationSceneDescriptor,
  CelebrationVariantContext,
} from '../models/celebration-pack';

/** Returns a scene that plays the descriptor through `LottieScene` and lives for `timing.maxLifetimeMs`. */
export const createCelebrationSceneFromDescriptor = (
  descriptor: CelebrationSceneDescriptor,
  loaders: CelebrationAssetLoaders,
  context: CelebrationVariantContext,
): CelebrationScene => {
  const PackScene: FC = () =>
    createElement(LottieScene, { scene: descriptor, loaders, context });
  return {
    id: descriptor.id,
    labelId: descriptor.labelId,
    durationMs: descriptor.timing.maxLifetimeMs,
    Component: PackScene,
  };
};

/** Returns a copy of `event` whose existing scenes are swapped for same-id replacements, keeping their `labelId`. */
export const replaceCelebrationScenes = (
  event: CelebrationEvent,
  scenes: readonly CelebrationScene[],
): CelebrationEvent => {
  const replacements = new Map(scenes.map((scene) => [scene.id, scene]));
  return {
    ...event,
    scenes: event.scenes.map((scene) => {
      const replacement = replacements.get(scene.id);
      return replacement ? { ...replacement, labelId: scene.labelId } : scene;
    }),
  };
};

const createStaticTrigger = (
  labelId: string,
  imageUrl: string | undefined,
): ComponentType<CelebrationDecorationProps> => {
  const PackTrigger: FC<CelebrationDecorationProps> = ({ onActivate }) => {
    const { labels } = useCelebrationEnvironment();
    return createElement(StaticTriggerDecoration, {
      onActivate,
      imageUrl,
      label: labels[labelId],
    });
  };
  return PackTrigger;
};

/** Returns the event an external-only pack describes; throws when the descriptor has no `event` block. */
export const createCelebrationEventFromDescriptor = (
  descriptor: CelebrationPackDescriptor,
  loaders: CelebrationAssetLoaders,
  context: CelebrationVariantContext,
): CelebrationEvent => {
  const { event } = descriptor;
  if (!event)
    throw new TypeError(
      `Pack ${descriptor.packId} does not describe an external event`,
    );
  const scenes = descriptor.scenes.map((scene) =>
    createCelebrationSceneFromDescriptor(scene, loaders, context),
  );
  const sceneIds = new Set(scenes.map(({ id }) => id));
  const { labelId, posterAssetId } = event.decoration;
  const labels = { ...descriptor.labels };
  if (!labels[labelId]) labels[labelId] = STATIC_TRIGGER_DEFAULT_LABEL;
  return {
    id: descriptor.eventId,
    iconUrl: event.iconAssetId
      ? loaders.resolveImageUrl(event.iconAssetId)
      : undefined,
    Decoration: createStaticTrigger(
      labelId,
      loaders.resolveImageUrl(posterAssetId),
    ),
    scenes,
    clickSceneIds: event.clickSceneIds.filter((id) => sceneIds.has(id)),
    labels,
    titleLabelId: event.titleLabelId,
  };
};
