import {
  type CelebrationAssetLoaders,
  type CelebrationEvent,
  type CelebrationEventLoader,
  type CelebrationPackDescriptor,
} from '@epam/ai-dial-celebrations';
import {
  CelebrationMediaType,
  type CelebrationAssetDto,
  type CelebrationPackDto,
} from '@epam/ai-dial-chat-api-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CelebrationPackPlan,
  CelebrationPacks,
  CelebrationPacksOptions,
} from '../../models/celebration-pack';
import {
  getCelebrationAssetUrl,
  getCelebrationCatalog,
  getCelebrationPack,
  loadCelebrationAssetJson,
} from '../../server-api/celebrations.api';
import { CelebrationPackTarget } from '../../types/celebration-pack';
import {
  resolveCelebrationPackLabels,
  resolveCelebrationPackPlan,
  toCelebrationPackDescriptor,
} from '../../utils/celebration-pack';

/** `packKey` when no pack applies to the active event. */
export const BUNDLED_PACK_KEY = 'bundled';

const NO_LABELS: CelebrationPacks['labels'] = {};

interface ResolvedPack {
  requestKey: string;
  pack: CelebrationPackDto;
  catalogRevision: string;
}

const loadEvent = async (
  load: CelebrationEventLoader,
): Promise<CelebrationEvent> => {
  const loaded = await load();
  return 'default' in loaded ? loaded.default : loaded;
};

const isImage = ({ mediaType }: CelebrationAssetDto): boolean =>
  mediaType !== CelebrationMediaType.ApplicationJson;

/* Assets are immutable, so parsed clips are kept for the page lifetime. */
const createAssetLoaders = (
  assets: readonly CelebrationAssetDto[],
  animations: Map<string, unknown>,
): CelebrationAssetLoaders => {
  const declared = new Map(assets.map((asset) => [asset.assetId, asset]));
  return {
    loadAnimationData: async (assetId, signal) => {
      const asset = declared.get(assetId);
      if (!asset || isImage(asset))
        throw new TypeError(`${assetId} is not a declared animation`);
      if (animations.has(assetId)) return animations.get(assetId);
      const data = await loadCelebrationAssetJson(assetId, signal);
      animations.set(assetId, data);
      return data;
    },
    resolveImageUrl: (assetId) => {
      const asset = declared.get(assetId);
      return asset && isImage(asset)
        ? getCelebrationAssetUrl(assetId)
        : undefined;
    },
  };
};

/**
 * Resolves the celebration pack an eligible event may use and composes it with
 * the compiled loaders: allowlisted scenes replace bundled ones by ID or, for
 * an ID the bundled event lacks, join its click pool. Requests nothing while the delivery policy admits no
 * pack for the event; any failure leaves the compiled registry in place.
 *
 * @example
 * ```tsx
 * const packs = useCelebrationPacks({
 *   compiledEvents: EVENTS,
 *   activeEventId,
 *   delivery: config.celebrationDelivery,
 *   colorScheme,
 *   direction: i18n.dir(i18n.resolvedLanguage),
 *   language: i18n.resolvedLanguage ?? 'en',
 * });
 * ```
 */
export const useCelebrationPacks = ({
  compiledEvents,
  activeEventId,
  delivery,
  colorScheme,
  direction,
  language,
}: CelebrationPacksOptions): CelebrationPacks => {
  const [resolved, setResolved] = useState<ResolvedPack | null>(null);
  const packCache = useRef(new Map<string, CelebrationPackDto>());
  /* Read during render to build loaders, so state rather than a ref. */
  const [animationCache] = useState(() => new Map<string, unknown>());

  /* Rebuilt from primitives, so a new policy object with the same content
     neither refetches nor recomposes. Scene IDs are kebab-case, never commas. */
  const draft = resolveCelebrationPackPlan(
    Object.keys(compiledEvents),
    activeEventId,
    delivery,
  );
  const planTarget = draft?.target;
  const planEventId = draft?.eventId;
  const planSceneIds = draft?.sceneIds.join(',') ?? '';
  const plan = useMemo<CelebrationPackPlan | null>(
    () =>
      planTarget && planEventId
        ? {
            target: planTarget,
            eventId: planEventId,
            sceneIds: planSceneIds ? planSceneIds.split(',') : [],
          }
        : null,
    [planTarget, planEventId, planSceneIds],
  );
  const requestKey = plan
    ? `${planTarget}:${planEventId}:${planSceneIds}`
    : null;

  useEffect(() => {
    if (!requestKey || !planEventId) return;
    const controller = new AbortController();
    let cancelled = false;
    const run = async () => {
      try {
        const catalog = await getCelebrationCatalog(controller.signal);
        if (cancelled) return;
        const ref = catalog.defaults[planEventId];
        if (!ref) {
          /* A pack removed from the index rolls a revisited event back too. */
          setResolved(null);
          return;
        }
        const cacheKey = `${ref.packId}@${ref.version}`;
        let pack = packCache.current.get(cacheKey);
        if (!pack) {
          pack = await getCelebrationPack(
            ref.packId,
            ref.version,
            controller.signal,
          );
          packCache.current.set(cacheKey, pack);
        }
        if (cancelled) return;
        setResolved({ requestKey, pack, catalogRevision: catalog.revision });
      } catch {
        /* Before activation a failure means bundled, or no external event. */
        if (!cancelled) setResolved(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey, planEventId]);

  const current = resolved?.requestKey === requestKey ? resolved : null;
  const pack = current?.pack;
  const descriptor = useMemo<CelebrationPackDescriptor | undefined>(
    () => (pack && plan ? toCelebrationPackDescriptor(pack, plan) : undefined),
    [pack, plan],
  );
  const target = descriptor ? plan?.target : undefined;

  const events = useMemo(() => {
    if (!descriptor || !pack || !activeEventId) return compiledEvents;
    const loaders = createAssetLoaders(pack.assets, animationCache);
    const context = { direction, colorScheme };
    if (target === CelebrationPackTarget.Known) {
      const loadBundled = compiledEvents[activeEventId];
      const loadComposed: CelebrationEventLoader = async () => {
        const bundled = await loadEvent(loadBundled);
        try {
          const packs = await import('@epam/ai-dial-celebrations/packs');
          const scenes = descriptor.scenes.map((scene) =>
            packs.createCelebrationSceneFromDescriptor(scene, loaders, context),
          );
          /* An allowlisted ID the bundled event defines is a replacement;
             any other allowlisted ID is an addition to the click pool. */
          return packs.addCelebrationScenes(
            packs.replaceCelebrationScenes(bundled, scenes),
            scenes,
            descriptor.labels,
          );
        } catch {
          /* A missing packs chunk is a failure before activation: stay bundled. */
          return bundled;
        }
      };
      return { ...compiledEvents, [activeEventId]: loadComposed };
    }
    const loadExternal: CelebrationEventLoader = async () =>
      (
        await import('@epam/ai-dial-celebrations/packs')
      ).createCelebrationEventFromDescriptor(descriptor, loaders, context);
    return { ...compiledEvents, [activeEventId]: loadExternal };
  }, [
    compiledEvents,
    activeEventId,
    animationCache,
    descriptor,
    pack,
    target,
    direction,
    colorScheme,
  ]);

  const labels = useMemo(
    () =>
      descriptor && pack
        ? {
            [descriptor.eventId]: resolveCelebrationPackLabels(
              pack.labels,
              language,
            ),
          }
        : NO_LABELS,
    [descriptor, pack, language],
  );

  let packKey = BUNDLED_PACK_KEY;
  if (descriptor) {
    packKey = `${descriptor.packId}@${descriptor.version}`;
    if (target === CelebrationPackTarget.Known)
      packKey += `:${descriptor.scenes.map(({ id }) => id).join(',')}`;
  }

  return {
    events,
    labels,
    packKey,
    catalogRevision: descriptor && current ? current.catalogRevision : null,
  };
};
