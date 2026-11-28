import { describe, expect, it } from 'vitest';
import { getTimeOfDayGreeting, type GreetingTranslations } from '../greeting';

const translations: GreetingTranslations = {
  morningWithName: 'Good morning, Will',
  morningNoName: 'Good morning',
  afternoonWithName: 'Good afternoon, Will',
  afternoonNoName: 'Good afternoon',
  eveningWithName: 'Good evening, Will',
  eveningNoName: 'Good evening',
  nightWithName: 'Good night, Will',
  nightNoName: 'Good night',
};

describe('getTimeOfDayGreeting', () => {
  describe('morning (5–11)', () => {
    it.each([5, 9, 11])('returns morning-with-name at hour %i', (hour) => {
      expect(getTimeOfDayGreeting(hour, translations, 'Will')).toBe(
        'Good morning, Will',
      );
    });

    it('returns morning-no-name when firstName is absent', () => {
      expect(getTimeOfDayGreeting(9, translations)).toBe('Good morning');
    });
  });

  describe('afternoon (12–16)', () => {
    it.each([12, 14, 16])('returns afternoon-with-name at hour %i', (hour) => {
      expect(getTimeOfDayGreeting(hour, translations, 'Will')).toBe(
        'Good afternoon, Will',
      );
    });

    it('returns afternoon-no-name when firstName is absent', () => {
      expect(getTimeOfDayGreeting(14, translations)).toBe('Good afternoon');
    });
  });

  describe('evening (17–20)', () => {
    it('returns evening-with-name at hour 17', () => {
      expect(getTimeOfDayGreeting(17, translations, 'Will')).toBe(
        'Good evening, Will',
      );
    });

    it('returns evening-with-name at hour 20', () => {
      expect(getTimeOfDayGreeting(20, translations, 'Will')).toBe(
        'Good evening, Will',
      );
    });

    it('returns evening-no-name when firstName is absent', () => {
      expect(getTimeOfDayGreeting(18, translations)).toBe('Good evening');
    });
  });

  describe('night (21–4)', () => {
    it.each([21, 2, 0, 4])('returns night-with-name at hour %i', (hour) => {
      expect(getTimeOfDayGreeting(hour, translations, 'Will')).toBe(
        'Good night, Will',
      );
    });

    it('returns night-no-name when firstName is absent', () => {
      expect(getTimeOfDayGreeting(23, translations)).toBe('Good night');
    });
  });

  describe('no-name fallback', () => {
    it('returns no-name variant when firstName is empty string', () => {
      expect(getTimeOfDayGreeting(10, translations, '')).toBe('Good morning');
    });
  });
});
