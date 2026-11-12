import {
  CelebrationColorScheme,
  CelebrationDecorationTemplate,
  CelebrationDirectionMode,
  CelebrationLayout,
  CelebrationPlacementTemplate,
  CelebrationStageAlign,
  CelebrationStageFit,
  SUPPORTED_CELEBRATION_CAPABILITIES,
  type CelebrationPackDescriptor,
  type CelebrationPlacementDescriptor,
  type CelebrationSceneDescriptor,
  type CelebrationVariantConditions,
} from '@epam/ai-dial-celebrations';
import {
  CelebrationDeliveryMode,
  type CelebrationDeliveryDto,
  type CelebrationEventDto,
  type CelebrationPackDto,
  type CelebrationPlacementDto,
  type CelebrationSceneDirection,
  type CelebrationSceneDto,
  type CelebrationStageAlign as CelebrationStageAlignDto,
  type CelebrationStageFit as CelebrationStageFitDto,
  type CelebrationVariantColorScheme,
  type CelebrationVariantConditionsDto,
  type CelebrationVariantLayout,
} from '@epam/ai-dial-chat-api-client';
import type { CelebrationPackPlan } from '../models/celebration-pack';
import { CelebrationPackTarget } from '../types/celebration-pack';
import { ThemeId } from '../types/theme-id';

/* The generated DTO enums and the library enums share their wire values; these
   tables make the compiler check that every DTO value has a library member. */
const STAGE_FIT: Record<CelebrationStageFitDto, CelebrationStageFit> = {
  contain: CelebrationStageFit.Contain,
  cover: CelebrationStageFit.Cover,
};

const STAGE_ALIGN: Record<CelebrationStageAlignDto, CelebrationStageAlign> = {
  center: CelebrationStageAlign.Center,
  top: CelebrationStageAlign.Top,
  bottom: CelebrationStageAlign.Bottom,
  'top-start': CelebrationStageAlign.TopStart,
  'top-end': CelebrationStageAlign.TopEnd,
  'bottom-start': CelebrationStageAlign.BottomStart,
  'bottom-end': CelebrationStageAlign.BottomEnd,
};

const DIRECTION_MODE: Record<
  CelebrationSceneDirection,
  CelebrationDirectionMode
> = {
  none: CelebrationDirectionMode.None,
  mirror: CelebrationDirectionMode.Mirror,
  variant: CelebrationDirectionMode.Variant,
};

const LAYOUT: Record<CelebrationVariantLayout, CelebrationLayout> = {
  mobile: CelebrationLayout.Mobile,
  desktop: CelebrationLayout.Desktop,
};

const COLOR_SCHEME: Record<
  CelebrationVariantColorScheme,
  CelebrationColorScheme
> = {
  light: CelebrationColorScheme.Light,
  dark: CelebrationColorScheme.Dark,
};

const FALLBACK_LABEL_LOCALE = 'en';

const isSupported = (capabilities: readonly string[]): boolean =>
  capabilities.every((capability) =>
    SUPPORTED_CELEBRATION_CAPABILITIES.has(capability),
  );

/** Returns `dark` for the built-in dark theme and `light` for every other theme. */
export const toCelebrationColorScheme = (
  themeId: string,
): CelebrationColorScheme =>
  themeId === ThemeId.Dark
    ? CelebrationColorScheme.Dark
    : CelebrationColorScheme.Light;

/** Returns what the policy lets the app request for an eligible event, or `null` when nothing may be requested. */
export const resolveCelebrationPackPlan = (
  compiledEventIds: readonly string[],
  activeEventId: string | null,
  delivery: CelebrationDeliveryDto,
): CelebrationPackPlan | null => {
  if (!activeEventId) return null;
  if (compiledEventIds.includes(activeEventId)) {
    if (delivery.mode !== CelebrationDeliveryMode.PreferExternal) return null;
    const sceneIds = [
      ...new Set(
        delivery.externalScenes
          .filter(({ eventId }) => eventId === activeEventId)
          .map(({ sceneId }) => sceneId),
      ),
    ].sort();
    return sceneIds.length
      ? {
          target: CelebrationPackTarget.Known,
          eventId: activeEventId,
          sceneIds,
        }
      : null;
  }
  return delivery.externalEvents.includes(activeEventId)
    ? {
        target: CelebrationPackTarget.External,
        eventId: activeEventId,
        sceneIds: [],
      }
    : null;
};

const toPlacement = (
  placement: CelebrationPlacementDto,
): CelebrationPlacementDescriptor | undefined =>
  placement.template === CelebrationPlacementTemplate.ViewportStageV1 &&
  placement.fit &&
  placement.align
    ? {
        template: CelebrationPlacementTemplate.ViewportStageV1,
        fit: STAGE_FIT[placement.fit],
        align: STAGE_ALIGN[placement.align],
      }
    : undefined;

const toConditions = (
  when: CelebrationVariantConditionsDto,
): CelebrationVariantConditions => ({
  ...(when.layout && { layout: LAYOUT[when.layout] }),
  ...(when.direction && { direction: when.direction }),
  ...(when.colorScheme && { colorScheme: COLOR_SCHEME[when.colorScheme] }),
});

/* A scene this client cannot place or play maps to `undefined`. */
const toSceneDescriptor = (
  scene: CelebrationSceneDto,
): CelebrationSceneDescriptor | undefined => {
  const placement = toPlacement(scene.placement);
  if (
    !placement ||
    !SUPPORTED_CELEBRATION_CAPABILITIES.has(scene.renderer) ||
    !isSupported(scene.requiredCapabilities)
  )
    return undefined;
  return {
    id: scene.id,
    labelId: scene.labelId,
    renderer: scene.renderer,
    requiredCapabilities: scene.requiredCapabilities,
    placement,
    direction: DIRECTION_MODE[scene.direction],
    timing: { ...scene.timing },
    posterAssetId: scene.posterAssetId,
    posterDurationMs: scene.posterDurationMs,
    variants: scene.variants.map((variant) => ({
      when: toConditions(variant.when),
      animationAssetId: variant.animationAssetId,
    })),
  };
};

const toExternalEvent = (
  event: CelebrationEventDto,
  sceneIds: ReadonlySet<string>,
): CelebrationPackDescriptor['event'] => {
  if (
    event.decoration.template !== CelebrationDecorationTemplate.StaticTriggerV1
  )
    return undefined;
  /* Every click scene must be playable here; a partial pool is not admitted. */
  if (!event.clickSceneIds.every((id) => sceneIds.has(id))) return undefined;
  return {
    titleLabelId: event.titleLabelId,
    clickSceneIds: event.clickSceneIds,
    ...(event.iconAssetId && { iconAssetId: event.iconAssetId }),
    decoration: {
      template: CelebrationDecorationTemplate.StaticTriggerV1,
      posterAssetId: event.decoration.posterAssetId,
      labelId: event.decoration.labelId,
    },
  };
};

/** Returns the library descriptor for the part of a pack the plan admits, or `undefined` when none of it applies. */
export const toCelebrationPackDescriptor = (
  pack: CelebrationPackDto,
  plan: CelebrationPackPlan,
): CelebrationPackDescriptor | undefined => {
  if (pack.eventId !== plan.eventId || !isSupported(pack.requiredCapabilities))
    return undefined;
  const supportedScenes = pack.scenes
    .map(toSceneDescriptor)
    .filter((scene): scene is CelebrationSceneDescriptor => scene != null);
  const base = {
    packId: pack.packId,
    version: pack.version,
    eventId: pack.eventId,
    labels: pack.labels[FALLBACK_LABEL_LOCALE] ?? {},
  };
  if (plan.target === CelebrationPackTarget.Known) {
    /* A known event takes scene replacements only, never event-level fields. */
    if (pack.event) return undefined;
    const allowlist = new Set(plan.sceneIds);
    const scenes = supportedScenes.filter(({ id }) => allowlist.has(id));
    return scenes.length ? { ...base, scenes } : undefined;
  }
  if (!pack.event) return undefined;
  const event = toExternalEvent(
    pack.event,
    new Set(supportedScenes.map(({ id }) => id)),
  );
  return event ? { ...base, scenes: supportedScenes, event } : undefined;
};

/** Returns pack labels for `language`, falling back per label to the base language and then to English. */
export const resolveCelebrationPackLabels = (
  labels: CelebrationPackDto['labels'],
  language: string,
): Record<string, string> => {
  const baseLanguage = language.split('-')[0];
  return {
    ...labels[FALLBACK_LABEL_LOCALE],
    ...labels[baseLanguage],
    ...labels[language],
  };
};

/** Returns per-event labels with host translations over pack labels, so a pack never overrides a bundled label ID. */
export const mergeCelebrationLabels = (
  packLabels: Readonly<Record<string, Readonly<Record<string, string>>>>,
  hostLabels: Readonly<Record<string, Readonly<Record<string, string>>>>,
): Record<string, Record<string, string>> =>
  Object.fromEntries(
    [...new Set([...Object.keys(packLabels), ...Object.keys(hostLabels)])].map(
      (eventId) => [
        eventId,
        { ...packLabels[eventId], ...hostLabels[eventId] },
      ],
    ),
  );
