import type { OnboardingHintDto } from './dto/onboarding-hint.dto';
import { toNullableText } from './text.util';
import { OnboardingHintTarget } from './types/onboarding-hint-target';

const MAX_ONBOARDING_HINTS = 20;

/* The id ends up as a localStorage value and in log lines, so it is held to a
 * short allowlist rather than accepted as free text. */
const HINT_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

const KNOWN_TARGETS = new Set<string>(Object.values(OnboardingHintTarget));

const isOnboardingHintTarget = (
  value: unknown,
): value is OnboardingHintTarget =>
  typeof value === 'string' && KNOWN_TARGETS.has(value);

/**
 * Normalizes the operator-authored onboarding hints. Like
 * `normalizeAnnouncements`, bad entries are dropped with a warning and never
 * throw: a typo in a Helm values file must not take down
 * `/api/v1/client-config`.
 */
export const normalizeOnboardingHints = (
  value: unknown,
  warn: (message: string) => void,
): OnboardingHintDto[] => {
  if (!Array.isArray(value)) {
    if (value != null) {
      warn('ONBOARDING_HINTS did not resolve to an array; ignoring it');
    }
    return [];
  }

  const hints: OnboardingHintDto[] = [];
  const seenIds = new Set<string>();

  for (const entry of value) {
    if (entry == null || typeof entry !== 'object') {
      warn('Ignoring onboarding hint entry that is not an object');
      continue;
    }

    const { id, target, title, description } = entry as Record<string, unknown>;

    if (typeof id !== 'string' || !HINT_ID_PATTERN.test(id)) {
      warn(
        'Ignoring onboarding hint with a missing id or one outside [A-Za-z0-9._-]{1,64}',
      );
      continue;
    }
    if (seenIds.has(id)) {
      warn(`Ignoring onboarding hint "${id}": the id is already used`);
      continue;
    }
    if (!isOnboardingHintTarget(target)) {
      warn(
        `Ignoring onboarding hint "${id}": target must be one of ${[...KNOWN_TARGETS].join(', ')}`,
      );
      continue;
    }

    const parsedTitle = toNullableText(title);
    if (!parsedTitle) {
      warn(`Ignoring onboarding hint "${id}": the title is blank or missing`);
      continue;
    }

    seenIds.add(id);
    hints.push({
      id,
      target,
      title: parsedTitle,
      description: toNullableText(description),
    });
  }

  if (hints.length > MAX_ONBOARDING_HINTS) {
    warn(
      `ONBOARDING_HINTS carried ${hints.length} entries; keeping the first ${MAX_ONBOARDING_HINTS} and dropping the rest`,
    );
    return hints.slice(0, MAX_ONBOARDING_HINTS);
  }

  return hints;
};
