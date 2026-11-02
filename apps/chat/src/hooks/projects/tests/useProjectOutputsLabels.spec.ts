import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../../constants/translation-keys';
import { useProjectOutputsLabels } from '../useProjectOutputsLabels';

describe('useProjectOutputsLabels', () => {
  it('resolves the Outputs strings from the projects and buttons namespaces', () => {
    const { result } = renderHook(() => useProjectOutputsLabels());

    expect(result.current).toMatchObject({
      title: ProjectsI18nKeys.OutputsTitle,
      showLessLabel: ButtonsI18nKeys.ShowLess,
      errorLabel: ProjectsI18nKeys.OutputsError,
      retryLabel: ButtonsI18nKeys.Retry,
    });
    expect(result.current.seeAllLabel?.(9)).toBe(
      ProjectsI18nKeys.OutputsSeeAll,
    );
    expect(result.current.openOutputLabel?.('report.pdf')).toBe(
      ProjectsI18nKeys.ViewOpenFile,
    );
  });

  it('keeps the same labels object between renders', () => {
    const { result, rerender } = renderHook(() => useProjectOutputsLabels());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
