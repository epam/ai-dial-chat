/** Pre-translated greeting phrase strings for each time-of-day period. */
export interface GreetingTranslations {
  morningWithName: string;
  morningNoName: string;
  afternoonWithName: string;
  afternoonNoName: string;
  eveningWithName: string;
  eveningNoName: string;
  nightWithName: string;
  nightNoName: string;
}

/**
 * Returns a time-of-day greeting string.
 * Hour ranges: morning 5–11, afternoon 12–16, evening 17–20, night 21–4.
 * When firstName is provided the with-name variant is returned; otherwise the no-name variant.
 */
export const getTimeOfDayGreeting = (
  hour: number,
  translations: GreetingTranslations,
  firstName?: string,
): string => {
  const hasName = firstName != null && firstName.length > 0;

  if (hour >= 5 && hour <= 11) {
    return hasName ? translations.morningWithName : translations.morningNoName;
  }
  if (hour >= 12 && hour <= 16) {
    return hasName
      ? translations.afternoonWithName
      : translations.afternoonNoName;
  }
  if (hour >= 17 && hour <= 20) {
    return hasName ? translations.eveningWithName : translations.eveningNoName;
  }
  return hasName ? translations.nightWithName : translations.nightNoName;
};
