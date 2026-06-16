import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityType } from '@/src/types/common';

import { parseDefaultModel } from '../default-server-settings';

vi.mock('@/src/utils/server/logger', () => ({
  logger: { error: vi.fn() },
}));

describe('parseDefaultModel', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns fallback when value is undefined', () => {
    const result = parseDefaultModel(undefined);
    expect(result.entityType).toBe(EntityType.Model);
    expect(result.entityReference).toBeTruthy();
  });

  it('returns fallback when value is empty string', () => {
    const result = parseDefaultModel('');
    expect(result.entityType).toBe(EntityType.Model);
  });

  it('parses a plain string as application type', () => {
    expect(parseDefaultModel('my-model')).toEqual({
      entityReference: 'my-model',
      entityType: EntityType.Application,
    });
  });

  it('parses a valid JSON object with entityType application', () => {
    expect(
      parseDefaultModel(
        '{"entityReference":"my-model","entityType":"application"}',
      ),
    ).toEqual({
      entityReference: 'my-model',
      entityType: EntityType.Application,
    });
  });

  it('parses a valid JSON object with entityType model', () => {
    expect(
      parseDefaultModel('{"entityReference":"my-model","entityType":"model"}'),
    ).toEqual({
      entityReference: 'my-model',
      entityType: EntityType.Model,
    });
  });

  it('normalizes entityType casing (MODEL → model)', () => {
    const result = parseDefaultModel(
      '{"entityReference":"my-model","entityType":"MODEL"}',
    );
    expect(result.entityType).toBe(EntityType.Model);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('normalizes entityType casing (Application → application)', () => {
    const result = parseDefaultModel(
      '{"entityReference":"my-model","entityType":"Application"}',
    );
    expect(result.entityType).toBe(EntityType.Application);
  });

  it('falls back and logs on unknown entityType', () => {
    const result = parseDefaultModel(
      '{"entityReference":"my-model","entityType":"toolset"}',
    );
    expect(result.entityType).toBe(EntityType.Model);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('falls back and logs on malformed JSON', () => {
    const result = parseDefaultModel('{"entityReference":"foo"');
    expect(result.entityType).toBe(EntityType.Model);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('falls back and logs when entityReference is missing', () => {
    const result = parseDefaultModel('{"entityType":"model"}');
    expect(result.entityType).toBe(EntityType.Model);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
