import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import { getCatalogSearchPlaceholder } from '../catalog';

/*
 * Resolves against the real locale file rather than echoing keys back, so a
 * key that never made it into `en.json` fails the assertion instead of
 * silently rendering as a dotted path.
 */
const t = ((key: string, params?: Record<string, string>) => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node == null ? undefined : (node as Record<string, unknown>)[segment],
      en,
    );
  if (typeof value !== 'string') {
    throw new Error(`Missing translation key: ${key}`);
  }
  return Object.entries(params ?? {}).reduce(
    (text, [name, replacement]) => text.replaceAll(`{{${name}}}`, replacement),
    value,
  );
}) as unknown as TFunction;

describe('getCatalogSearchPlaceholder', () => {
  it('names the single entity type an agent-only picker offers', () => {
    expect(getCatalogSearchPlaceholder([CatalogEntityType.Agent], t)).toBe(
      'Search agents…',
    );
  });

  it('lists every offered type in the given order', () => {
    expect(
      getCatalogSearchPlaceholder(
        [
          CatalogEntityType.Model,
          CatalogEntityType.Agent,
          CatalogEntityType.Toolset,
          CatalogEntityType.Skill,
          CatalogEntityType.Prompt,
        ],
        t,
      ),
    ).toBe('Search models, agents, toolsets, skills, prompts…');
  });

  it('falls back to the generic placeholder when no type is available', () => {
    expect(getCatalogSearchPlaceholder([], t)).toBe('Search...');
  });
});
