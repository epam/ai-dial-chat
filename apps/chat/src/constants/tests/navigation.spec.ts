import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import { ROUTES } from '../../types/routes';
import { NAVIGATION_CONFIG } from '../navigation';
import { NavigationI18nKeys } from '../translation-keys';

const resolveKey = (key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (value, segment) =>
        value != null && typeof value === 'object'
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      en,
    );

describe('NAVIGATION_CONFIG', () => {
  it('includes a File Manager entry pointing at ROUTES.FileManager', () => {
    const fileManagerItem = NAVIGATION_CONFIG.find(
      (item) => item.path === ROUTES.FileManager,
    );
    expect(fileManagerItem).toBeTruthy();
    expect(fileManagerItem?.labelKey).toBe(NavigationI18nKeys.FileManager);
  });

  it('resolves the File Manager nav label key to an existing en.json string', () => {
    expect(resolveKey(NavigationI18nKeys.FileManager)).toBe('File Manager');
  });

  it('includes a Scheduled Tasks entry gated behind the scheduledTasksEnabled flag', () => {
    const scheduledTasksItem = NAVIGATION_CONFIG.find(
      (item) => item.path === ROUTES.ScheduledTasks,
    );
    expect(scheduledTasksItem).toBeTruthy();
    expect(scheduledTasksItem?.labelKey).toBe(
      NavigationI18nKeys.ScheduledTasks,
    );
    expect(scheduledTasksItem?.featureFlag).toBe('scheduledTasksEnabled');
  });

  it('resolves every nav item label key to an existing en.json string', () => {
    NAVIGATION_CONFIG.forEach((item) => {
      expect(typeof resolveKey(item.labelKey)).toBe('string');
    });
  });
});
