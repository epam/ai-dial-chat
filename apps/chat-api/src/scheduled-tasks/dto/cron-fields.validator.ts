import { registerDecorator, type ValidationOptions } from 'class-validator';

interface CronFieldRule {
  min: number;
  max: number;
  aliases?: readonly string[];
}

const CRON_FIELD_RULES: Record<string, CronFieldRule> = {
  year: { min: 1970, max: 9999 },
  month: {
    min: 1,
    max: 12,
    aliases: [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ],
  },
  day: { min: 1, max: 31 },
  week: { min: 1, max: 53 },
  day_of_week: {
    min: 0,
    max: 6,
    aliases: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  },
  hour: { min: 0, max: 23 },
  minute: { min: 0, max: 59 },
  second: { min: 0, max: 59 },
};

const getTokenValue = (
  token: string,
  rule: CronFieldRule,
): number | undefined => {
  const aliasIndex = rule.aliases?.indexOf(token.toLowerCase()) ?? -1;
  if (aliasIndex >= 0) {
    return rule.min + aliasIndex;
  }
  if (!/^\d+$/.test(token)) {
    return undefined;
  }
  const numericValue = Number(token);
  return numericValue >= rule.min && numericValue <= rule.max
    ? numericValue
    : undefined;
};

const isCronSegment = (segment: string, rule: CronFieldRule): boolean => {
  const [range, step, ...extraStepParts] = segment.split('/');
  if (!range || extraStepParts.length > 0) {
    return false;
  }
  if (
    step !== undefined &&
    (!/^\d+$/.test(step) ||
      Number(step) < 1 ||
      Number(step) > rule.max - rule.min + 1)
  ) {
    return false;
  }
  if (range === '*') {
    return true;
  }

  const [start, end, ...extraRangeParts] = range.split('-');
  if (!start || extraRangeParts.length > 0) {
    return false;
  }
  const startValue = getTokenValue(start, rule);
  if (startValue === undefined) {
    return false;
  }
  if (end === undefined) {
    return true;
  }
  const endValue = getTokenValue(end, rule);
  return endValue !== undefined && startValue <= endValue;
};

const isCronFieldValue = (value: unknown, rule: CronFieldRule): boolean =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 100 &&
  value.split(',').every((segment) => isCronSegment(segment, rule));

const isCronFields = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(([field, fieldValue]) => {
      const rule = CRON_FIELD_RULES[field];
      return rule !== undefined && isCronFieldValue(fieldValue, rule);
    })
  );
};

export const IsCronFields = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCronFields',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isCronFields,
        defaultMessage() {
          return 'fields must be a non-empty cron field map with supported keys and valid string expressions';
        },
      },
    });
  };
};
