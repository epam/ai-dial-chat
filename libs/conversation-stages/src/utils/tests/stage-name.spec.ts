import { describe, expect, it } from 'vitest';
import {
  calculateStagesDurationSeconds,
  cleanStageName,
  formatTotalDuration,
  isIdentifierLike,
  parseDurationSeconds,
} from '../stage-name';

describe('cleanStageName', () => {
  it('strips a bracketed duration and leaves the rest of the name untouched', () => {
    expect(
      cleanStageName('PyInterpreter: Read Weather Data File [3.99s]'),
    ).toEqual({
      name: 'PyInterpreter: Read Weather Data File',
      durationLabel: '3.99s',
    });
  });

  it('strips a parenthesized duration plus its accompanying timestamps as one group', () => {
    expect(
      cleanStageName(
        '[DEBUG] Performance Of Request (7.18s, Start: 11:21:38, End: 11:21:45)',
      ),
    ).toEqual({
      name: '[DEBUG] Performance Of Request',
      durationLabel: '7.18s',
    });
  });

  it('strips a trailing colon when there is no duration', () => {
    expect(cleanStageName('Call My_OMDB_Agent__0_0_1_tool:')).toEqual({
      name: 'Call My_OMDB_Agent__0_0_1_tool',
      durationLabel: undefined,
    });
  });

  it('does not strip a colon that is not at the very end', () => {
    const { name } = cleanStageName('PyInterpreter: Read weather data file');
    expect(name).toBe('PyInterpreter: Read weather data file');
  });

  it('returns an empty name instead of throwing when given null (DIAL Core "stage opened" chunk)', () => {
    expect(cleanStageName(null as unknown as string)).toEqual({
      name: '',
      durationLabel: undefined,
    });
  });

  it('returns an empty name instead of throwing when given undefined', () => {
    expect(cleanStageName(undefined as unknown as string)).toEqual({
      name: '',
      durationLabel: undefined,
    });
  });

  it('does not force Title Case or otherwise rewrite the remaining text', () => {
    expect(cleanStageName('Via MCP').name).toBe('Via MCP');
    expect(cleanStageName('Read Weather Data File').name).toBe(
      'Read Weather Data File',
    );
  });

  it('leaves an unrelated bracket (no duration inside) untouched', () => {
    expect(cleanStageName('[DEBUG] Usage statistics').name).toBe(
      '[DEBUG] Usage statistics',
    );
  });

  it('returns the name unchanged with no duration when none is present', () => {
    expect(cleanStageName('Usage statistics')).toEqual({
      name: 'Usage statistics',
      durationLabel: undefined,
    });
  });

  it('collapses leftover double spaces after removing an embedded duration group', () => {
    expect(cleanStageName('Notion  ·  create pages [1.97s]').name).toBe(
      'Notion · create pages',
    );
  });
});

describe('isIdentifierLike', () => {
  it('treats a whitespace-free underscored string as an identifier', () => {
    expect(isIdentifierLike('My_OMDB_Agent__0_0_1_tool')).toBe(true);
  });

  it('does not treat prose with an embedded identifier as an identifier', () => {
    expect(isIdentifierLike('Call My_OMDB_Agent__0_0_1_tool')).toBe(false);
  });

  it('does not treat ordinary prose as an identifier', () => {
    expect(isIdentifierLike('Read Weather Data File')).toBe(false);
    expect(isIdentifierLike('Via MCP')).toBe(false);
    expect(isIdentifierLike('Notion · create pages')).toBe(false);
  });

  it('does not treat a whitespace-free string with no underscore as an identifier', () => {
    expect(isIdentifierLike('Standalone')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isIdentifierLike('')).toBe(false);
  });
});

describe('formatTotalDuration', () => {
  it('formats sub-minute durations with one decimal place', () => {
    expect(formatTotalDuration(21.4)).toBe('21.4s');
    expect(formatTotalDuration(18.2)).toBe('18.2s');
  });

  it('formats durations of a minute or more as minutes and whole seconds', () => {
    expect(formatTotalDuration(318)).toBe('5m 18s');
  });

  it('rounds the seconds component when formatting minutes', () => {
    expect(formatTotalDuration(90.6)).toBe('1m 31s');
  });
});

describe('parseDurationSeconds', () => {
  it('parses a duration label back into seconds', () => {
    expect(parseDurationSeconds('3.99s')).toBe(3.99);
    expect(parseDurationSeconds('300.01s')).toBe(300.01);
  });

  it('returns undefined for an absent or malformed label', () => {
    expect(parseDurationSeconds(undefined)).toBeUndefined();
    expect(parseDurationSeconds('not-a-duration')).toBeUndefined();
  });
});

describe('calculateStagesDurationSeconds', () => {
  it('counts parallel stages once', () => {
    expect(
      calculateStagesDurationSeconds([
        'Tool A (40s, Start: 11:21:00, End: 11:21:40)',
        'Tool B (40s, Start: 11:21:00, End: 11:21:40)',
        'Tool C (40s, Start: 11:21:00, End: 11:21:40)',
      ]),
    ).toBe(40);
  });

  it('counts the union of partially overlapping and sequential stages', () => {
    expect(
      calculateStagesDurationSeconds([
        'Tool A (20s, Start: 11:21:00, End: 11:21:20)',
        'Tool B (20s, Start: 11:21:10, End: 11:21:30)',
        'Tool C (10s, Start: 11:21:40, End: 11:21:50)',
      ]),
    ).toBe(40);
  });

  it('normalizes stages that overlap across midnight', () => {
    expect(
      calculateStagesDurationSeconds([
        'Tool A (20s, Start: 23:59:50, End: 00:00:10)',
        'Tool B (10s, Start: 00:00:05, End: 00:00:15)',
      ]),
    ).toBe(25);
  });

  it('does not infer a midnight rollover from a wide same-day time range', () => {
    expect(
      calculateStagesDurationSeconds([
        'Tool A (1.00s, Start: 00:00:00, End: 00:00:01)',
        'Tool B (3.00s, Start: 11:59:59, End: 12:00:02)',
        'Tool C (4.00s, Start: 12:00:00, End: 12:00:04)',
        'Tool D (1.00s, Start: 23:59:59, End: 00:00:00)',
      ]),
    ).toBe(7);
  });

  it('falls back to summing durations when a stage has no start timestamp', () => {
    expect(
      calculateStagesDurationSeconds([
        'Tool A (40s, Start: 11:21:00, End: 11:21:40)',
        'Legacy tool [40s]',
      ]),
    ).toBe(80);
  });
});
