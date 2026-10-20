import { describe, expect, it } from 'vitest';
import { sanitizeToolName } from '../mcp-app';

describe('sanitizeToolName', () => {
  it('leaves an already valid name untouched', () => {
    expect(sanitizeToolName('weather_get-weather')).toBe('weather_get-weather');
  });

  it('replaces spaces with underscores', () => {
    expect(sanitizeToolName('Entity MCP Server_show_entity_card')).toBe(
      'Entity_MCP_Server_show_entity_card',
    );
  });

  it('collapses a run of invalid characters into a single underscore', () => {
    expect(sanitizeToolName('My  (Toolset) run')).toBe('My_Toolset_run');
  });

  it('keeps an underscore that follows a replaced run', () => {
    expect(sanitizeToolName('Toolset)_run')).toBe('Toolset__run');
  });

  it('keeps the trailing separator of a toolset prefix', () => {
    expect(sanitizeToolName('Entity MCP Server_')).toBe('Entity_MCP_Server_');
  });

  it('prefixes a name starting with a digit', () => {
    expect(sanitizeToolName('1st toolset_run')).toBe('_1st_toolset_run');
  });

  it('prefixes a name starting with a hyphen', () => {
    expect(sanitizeToolName('-tool')).toBe('_-tool');
  });

  it('does not prefix a name starting with an underscore', () => {
    expect(sanitizeToolName('_tool')).toBe('_tool');
  });

  it('truncates to 64 characters', () => {
    expect(sanitizeToolName('a'.repeat(100))).toHaveLength(64);
  });

  it('returns an empty string as is', () => {
    expect(sanitizeToolName('')).toBe('');
  });

  it('lets a truncated tool name still start with the sanitized prefix', () => {
    const prefix = sanitizeToolName(`${'very long toolset '.repeat(5)}_`);
    const name = sanitizeToolName(
      `${'very long toolset '.repeat(5)}_show_entity_card`,
    );
    expect(name.startsWith(prefix)).toBe(true);
  });
});
