import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getFromLocalStorage, setToLocalStorage } from './local-storage';

describe('localStorage utilities', () => {
  describe('getFromLocalStorage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should return value from localStorage', () => {
      localStorage.setItem('testKey', 'testValue');
      const result = getFromLocalStorage('testKey');
      expect(result).toBe('testValue');
    });

    it('should return null when key not found', () => {
      const result = getFromLocalStorage('nonExistentKey');
      expect(result).toBeNull();
    });

    it('should return empty string when key is undefined', () => {
      const result = getFromLocalStorage(undefined);
      expect(result).toBe('');
    });

    it('should return empty string when key is empty string', () => {
      const result = getFromLocalStorage('');
      expect(result).toBe('');
    });

    it('should handle multiple keys', () => {
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');

      expect(getFromLocalStorage('key1')).toBe('value1');
      expect(getFromLocalStorage('key2')).toBe('value2');
    });
  });

  describe('getFromLocalStorage - SSR environment', () => {
    let originalWindow: typeof globalThis.window;

    beforeEach(() => {
      originalWindow = globalThis.window;
    });

    afterEach(() => {
      globalThis.window = originalWindow;
    });

    it('should return empty string in SSR environment (no window)', () => {
      // Simulate SSR by deleting window
      // @ts-expect-error - Testing SSR behavior
      delete globalThis.window;

      const result = getFromLocalStorage('testKey');
      expect(result).toBe('');
    });
  });

  describe('setToLocalStorage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should set value in localStorage', () => {
      setToLocalStorage('testKey', 'testValue');
      expect(localStorage.getItem('testKey')).toBe('testValue');
    });

    it('should overwrite existing value', () => {
      localStorage.setItem('testKey', 'oldValue');
      setToLocalStorage('testKey', 'newValue');
      expect(localStorage.getItem('testKey')).toBe('newValue');
    });

    it('should handle empty string value', () => {
      setToLocalStorage('testKey', '');
      expect(localStorage.getItem('testKey')).toBe('');
    });

    it('should handle multiple sets', () => {
      setToLocalStorage('key1', 'value1');
      setToLocalStorage('key2', 'value2');

      expect(localStorage.getItem('key1')).toBe('value1');
      expect(localStorage.getItem('key2')).toBe('value2');
    });
  });
});
