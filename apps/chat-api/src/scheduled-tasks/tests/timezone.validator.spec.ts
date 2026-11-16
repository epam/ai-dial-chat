import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IsIanaTimezone, isKnownTimezone } from '../dto/timezone.validator';

class Sample {
  @IsIanaTimezone()
  timezone!: string;
}

describe('isKnownTimezone', () => {
  it.each([
    'Europe/Berlin',
    'UTC',
    'Asia/Calcutta',
    'America/Argentina/Buenos_Aires',
    'Etc/GMT+2',
  ])('accepts %s', (value) => {
    expect(isKnownTimezone(value)).toBe(true);
  });

  it.each([
    'Mars/Olympus',
    '+02:00',
    '+02',
    '-0330',
    '',
    '../../etc/passwd',
    'Europe/Berlin\n',
    'A'.repeat(65),
  ])('rejects %j', (value) => {
    expect(isKnownTimezone(value)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isKnownTimezone(undefined)).toBe(false);
    expect(isKnownTimezone(120)).toBe(false);
  });
});

describe('IsIanaTimezone', () => {
  it('reports a validation error for an unknown identifier', async () => {
    const sample = Object.assign(new Sample(), { timezone: 'Mars/Olympus' });

    const errors = await validate(sample);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isIanaTimezone).toContain('IANA');
  });

  it('passes a valid identifier', async () => {
    const sample = Object.assign(new Sample(), { timezone: 'Europe/Warsaw' });

    expect(await validate(sample)).toHaveLength(0);
  });
});
