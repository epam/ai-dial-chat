import type {
  CelebrationEvent,
  CelebrationEventSelection,
} from '../models/celebration';

/** Keep letters from every locale; a phrase must still match the entire input. */
export const normalizeCelebrationPhrase = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();

export const matchesCelebrationPhrase = (
  text: string,
  phrases: readonly string[],
): boolean => {
  const normalized = normalizeCelebrationPhrase(text);
  return (
    normalized.length > 0 &&
    phrases.some((phrase) => normalizeCelebrationPhrase(phrase) === normalized)
  );
};

/** Empty and single-scene events are valid, too. */
export const pickCelebrationScene = (
  ids: readonly string[],
  previous?: string,
): string | undefined => {
  const unique = [...new Set(ids)];
  const choices =
    unique.length > 1 ? unique.filter((id) => id !== previous) : unique;
  return choices[Math.floor(Math.random() * choices.length)];
};

/** Replaces every `{{phrase}}` placeholder in a label. */
export const interpolateCelebrationLabel = (
  label: string,
  phrase: string,
): string => label.replace(/\{\{\s*phrase\s*\}\}/g, phrase);

export interface CelebrationPools {
  enabledSceneIds: ReadonlySet<string>;
  clickSceneIds: readonly string[];
  secretSceneIds: readonly string[];
  enabledDecorBehaviors: ReadonlySet<string>;
  isSecretEnabled: boolean;
}

/** Applies a host selection to an event; unknown ids simply drop out. */
export const resolveCelebrationPools = (
  event: CelebrationEvent,
  selection: CelebrationEventSelection = {},
): CelebrationPools => {
  const sceneIds = event.scenes.map(({ id }) => id);
  const allowed = selection.enabledScenes
    ? new Set(selection.enabledScenes)
    : new Set(sceneIds);
  const disabled = new Set(selection.disabledScenes);
  const enabledSceneIds = new Set(
    sceneIds.filter((id) => allowed.has(id) && !disabled.has(id)),
  );
  const disabledBehaviors = new Set(selection.disabledDecorBehaviors);
  const secretSceneIds = (event.secretTrigger?.sceneIds ?? []).filter((id) =>
    enabledSceneIds.has(id),
  );
  return {
    enabledSceneIds,
    clickSceneIds: event.clickSceneIds.filter((id) => enabledSceneIds.has(id)),
    secretSceneIds,
    enabledDecorBehaviors: new Set(
      (event.decorBehaviors ?? []).filter((id) => !disabledBehaviors.has(id)),
    ),
    isSecretEnabled:
      selection.isSecretEnabled !== false && secretSceneIds.length > 0,
  };
};
