import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSearchPlaceholderByTab } from '../useSearchPlaceholderByTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('useSearchPlaceholderByTab', () => {
  it('names the searched storage for each source tab', () => {
    const { result } = renderHook(() => useSearchPlaceholderByTab());

    expect(result.current).toEqual({
      [DialFileManagerTabs.MyFiles]:
        'dialFileManager.searchPlaceholder.myFiles',
      [DialFileManagerTabs.Shared]: 'dialFileManager.searchPlaceholder.shared',
      [DialFileManagerTabs.Organization]:
        'dialFileManager.searchPlaceholder.organization',
    });
  });
});
