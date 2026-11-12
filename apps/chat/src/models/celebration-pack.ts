import type {
  CelebrationColorScheme,
  CelebrationEventLoader,
  CelebrationTextDirection,
} from '@epam/ai-dial-celebrations';
import type { CelebrationDeliveryDto } from '@epam/ai-dial-chat-api-client';
import type { CelebrationPackTarget } from '../types/celebration-pack';

/** What the app may request a pack for once an event has passed eligibility. */
export interface CelebrationPackPlan {
  /** Whether the pack replaces scenes of a compiled event or describes a whole event. */
  target: CelebrationPackTarget;
  /** The eligible event. */
  eventId: string;
  /** Allowlisted scene IDs of a known event, sorted; empty for an external event. */
  sceneIds: readonly string[];
}

/** Inputs of `useCelebrationPacks`; every value is already resolved by the host. */
export interface CelebrationPacksOptions {
  /** The compiled event loaders; never derived from an event ID. */
  compiledEvents: Readonly<Record<string, CelebrationEventLoader>>;
  /** The event that passed the host gates, or `null`. */
  activeEventId: string | null;
  /** The operator's delivery policy. */
  delivery: CelebrationDeliveryDto;
  /** Color scheme pack variants are selected for. */
  colorScheme: CelebrationColorScheme;
  /** Writing direction of the resolved language. */
  direction: CelebrationTextDirection;
  /** Resolved UI language, used to localize pack labels. */
  language: string;
}

/** What `useCelebrationPacks` hands to `CelebrationProvider`. */
export interface CelebrationPacks {
  /** The compiled loaders, with the active event composed from its pack when one applies. */
  events: Readonly<Record<string, CelebrationEventLoader>>;
  /** Localized pack labels by event ID; host translations take precedence. */
  labels: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** `packId@version` plus the replaced scenes, or `bundled` when no pack applies. */
  packKey: string;
  /** Revision of the celebration index the applied pack came from, or `null`. */
  catalogRevision: string | null;
}
