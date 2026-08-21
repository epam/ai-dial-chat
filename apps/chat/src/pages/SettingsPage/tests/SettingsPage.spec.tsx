import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BasicI18nKeys } from '../../../constants/translation-keys';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import * as useUsageDataModule from '../../../hooks/useUsageData';
import SettingsPage from '../SettingsPage';

const mockUseFeatureFlag = vi.fn();
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string) => mockUseFeatureFlag(key),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock('../../../hooks/useUsageData', () => ({
  useUsageData: vi.fn(),
}));

vi.mocked(useUsageDataModule.useUsageData).mockReturnValue({
  limits: undefined,
  usage: undefined,
  isLoading: true,
  limitsError: undefined,
  usageError: undefined,
});

describe('SettingsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockReturnValue(true);
    const { useNotification } =
      await import('../../../context/NotificationContext');
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(vi.fn()),
    );
  });

  it('renders exactly one tab, labeled Usage, selected by default', () => {
    render(<SettingsPage />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0].textContent).toContain(BasicI18nKeys.Usage);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('exposes a tablist for the panel', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('invokes useUsageData with the settingsPageEnabled flag when the Usage tab is active', () => {
    render(<SettingsPage />);

    expect(useUsageDataModule.useUsageData).toHaveBeenCalledWith(true);
  });

  it('invokes useUsageData with enabled=false when the settingsPageEnabled flag is disabled', () => {
    mockUseFeatureFlag.mockReturnValue(false);

    render(<SettingsPage />);

    expect(useUsageDataModule.useUsageData).toHaveBeenCalledWith(false);
  });
});
