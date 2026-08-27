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
    it('returns morning-with-name at hour 5', () => {
      expect(getTimeOfDayGreeting(5, translations, 'Will')).toBe(
        'Good morning, Will',
      );
    });

    it('returns morning-with-name at hour 9', () => {
      expect(getTimeOfDayGreeting(9, translations, 'Will')).toBe(
        'Good morning, Will',
      );
    });

    it('returns morning-with-name at hour 11', () => {
      expect(getTimeOfDayGreeting(11, translations, 'Will')).toBe(
        'Good morning, Will',
      );
    });

    it('returns morning-no-name when firstName is absent', () => {
      expect(getTimeOfDayGreeting(9, translations)).toBe('Good morning');
    });
  });

  describe('afternoon (12–16)', () => {
    it('returns afternoon-with-name at hour 12', () => {
      expect(getTimeOfDayGreeting(12, translations, 'Will')).toBe(
        'Good afternoon, Will',
      );
    });

    it('returns afternoon-with-name at hour 14', () => {
      expect(getTimeOfDayGreeting(14, translations, 'Will')).toBe(
        'Good afternoon, Will',
      );
    });

    it('returns afternoon-with-name at hour 16', () => {
      expect(getTimeOfDayGreeting(16, translations, 'Will')).toBe(
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
    it('returns night-with-name at hour 21', () => {
      expect(getTimeOfDayGreeting(21, translations, 'Will')).toBe(
        'Good night, Will',
      );
    });

    it('returns night-with-name at hour 2', () => {
      expect(getTimeOfDayGreeting(2, translations, 'Will')).toBe(
        'Good night, Will',
      );
    });

    it('returns night-with-name at hour 0', () => {
      expect(getTimeOfDayGreeting(0, translations, 'Will')).toBe(
        'Good night, Will',
      );
    });

    it('returns night-with-name at hour 4', () => {
      expect(getTimeOfDayGreeting(4, translations, 'Will')).toBe(
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
