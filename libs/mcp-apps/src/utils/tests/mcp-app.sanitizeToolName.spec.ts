import { describe, expect, it } from 'vitest';
import { sanitizeToolName } from '../mcp-app';

describe('sanitizeToolName', () => {
  it.each([
    [
      'leaves an already valid name untouched',
      { name: 'weather_get-weather', expected: 'weather_get-weather' },
    ],
    [
      'replaces spaces with underscores',
      {
        name: 'Entity MCP Server_show_entity_card',
        expected: 'Entity_MCP_Server_show_entity_card',
      },
    ],
    [
      'collapses a run of invalid characters into a single underscore',
      { name: 'My  (Toolset) run', expected: 'My_Toolset_run' },
    ],
    [
      'keeps an underscore that follows a replaced run',
      { name: 'Toolset)_run', expected: 'Toolset__run' },
    ],
    [
      'keeps the trailing separator of a toolset prefix',
      { name: 'Entity MCP Server_', expected: 'Entity_MCP_Server_' },
    ],
    [
      'prefixes a name starting with a digit',
      { name: '1st toolset_run', expected: '_1st_toolset_run' },
    ],
    [
      'prefixes a name starting with a hyphen',
      { name: '-tool', expected: '_-tool' },
    ],
    [
      'does not prefix a name starting with an underscore',
      { name: '_tool', expected: '_tool' },
    ],
    ['returns an empty string as is', { name: '', expected: '' }],
  ])('%s', (_name, { name, expected }) => {
    expect(sanitizeToolName(name)).toBe(expected);
  });

  it('truncates to 64 characters', () => {
    expect(sanitizeToolName('a'.repeat(100))).toHaveLength(64);
  });

  it('lets a truncated tool name still start with the sanitized prefix', () => {
    const prefix = sanitizeToolName(`${'very long toolset '.repeat(5)}_`);
    const name = sanitizeToolName(
      `${'very long toolset '.repeat(5)}_show_entity_card`,
    );
    expect(name.startsWith(prefix)).toBe(true);
  });
});
