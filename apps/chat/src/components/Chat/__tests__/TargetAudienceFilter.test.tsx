/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getFilterLabel } from '@/src/utils/app/rules';

import { PublicationFunctions } from '@/src/types/publication';
import { AppAction } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/selectors';

import { TargetAudienceFilterComponent } from '@/src/components/Chat/Publish/TargetAudienceFilterComponent';

vi.mock('@/src/utils/app/mobile', () => ({
  isSmallScreen: () => false,
}));

vi.mock('next/router', () => ({
  useRouter: vi.fn().mockReturnValue({
    locale: 'en',
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      getResourceBundle: () => ({}),
      addResourceBundle: vi.fn(),
    },
  }),
  i18n: {
    t: (key: string) => key,
    getResourceBundle: () => ({}),
    addResourceBundle: vi.fn(),
  },
}));

vi.mock('@/src/store/hooks', async () => {
  return {
    useAppSelector: (selector: any) => selector({}),
    useAppDispatch: () => (action: AppAction) => action,
  };
});

vi.mock('@/src/store/selectors', async () => {
  const actual: any = await vi.importActual('@/src/store/selectors');
  return {
    ...actual,
    SettingsSelectors: {
      selectPublicationFilters: vi.fn(),
    },
  };
});

describe('TargetAudienceFilterComponent', () => {
  const targetValues = ['Title', 'Dial Roles', 'Job Title'];
  const filterValues = [
    PublicationFunctions.Contain,
    PublicationFunctions.Equal,
    PublicationFunctions.Regex,
    // TODO: uncomment when it will be supported on core
    // PublicationFunctions.True,
    // PublicationFunctions.False,
  ];

  const defaultFilterOption = 'Select';

  let onSaveFilter: any;
  let onCLoseFilter: any;

  beforeEach(() => {
    vi.mocked(SettingsSelectors.selectPublicationFilters).mockReturnValue(
      targetValues,
    );
    onSaveFilter = vi.fn();
    onCLoseFilter = vi.fn();
  });

  it('renders all filter and target options and placeholder correctly', async () => {
    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    if (!screen.queryByText(targetValues[0])) {
      await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    }

    for (const option of targetValues) {
      expect(screen.getByText(option)).toBeInTheDocument();
    }

    const selectedTargetOption = screen.getByText(targetValues[0]);
    await userEvent.click(selectedTargetOption);

    await userEvent.click(screen.getByTestId('open-filter-dropdown-filterFns'));

    const operatorMenu = screen.getAllByRole('menu').pop() as HTMLElement;
    for (const option of filterValues) {
      expect(
        within(operatorMenu).getByText(getFilterLabel(option)),
      ).toBeInTheDocument();
    }

    const selectedFilterOption = within(operatorMenu).getByText(
      getFilterLabel(filterValues[1]),
    );
    await userEvent.click(selectedFilterOption);

    expect(screen.queryByText(defaultFilterOption)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter one or more options...'));
  });

  it('selects an filter and target options on click', async () => {
    const selectedFilter = getFilterLabel(filterValues[1]);
    const selectedTarget = targetValues[0];

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    if (!screen.queryByText(selectedTarget)) {
      await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    }
    await userEvent.click(screen.getByText(selectedTarget));

    await userEvent.click(screen.getByTestId('open-filter-dropdown-filterFns'));
    await userEvent.click(screen.getByText(selectedFilter));

    expect(screen.getByText(selectedFilter)).toBeInTheDocument();
    expect(screen.getByText(selectedTarget)).toBeInTheDocument();
  });

  it('save button is disabled when target is chosen but value params are empty', async () => {
    const selectedTarget = targetValues[0];

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    if (!screen.queryByText(selectedTarget)) {
      await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    }
    await userEvent.click(screen.getByText(selectedTarget));

    const iconCheck = screen.getByTestId('save-filter');

    expect(iconCheck).toBeDisabled();
  });

  it('fires onSaveFilter method if click on check icon with filter params', async () => {
    const selectedFilter = getFilterLabel(filterValues[1]);
    const selectedTarget = targetValues[0];

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    if (!screen.queryByText(selectedTarget)) {
      await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    }
    await userEvent.click(screen.getByText(selectedTarget));

    await userEvent.click(screen.getByTestId('open-filter-dropdown-filterFns'));
    await userEvent.click(screen.getByText(selectedFilter));

    const combobox = screen.getByRole('combobox');
    await userEvent.type(combobox, 'QA{enter}');
    await userEvent.type(combobox, 'Developer{enter}');
    await userEvent.type(combobox, 'Manager{enter}');

    const iconCheck = screen.getByTestId('save-filter');
    await userEvent.click(iconCheck);

    expect(onSaveFilter).toHaveBeenCalledWith({
      source: selectedTarget,
      filterFunction: PublicationFunctions.Equal,
      filterParams: ['QA', 'Developer', 'Manager'],
    });
  });

  // TODO: uncomment when it will be supported on core
  // it('fires onSaveFilter method with empty filterParams if click on check icon with TRUE filter param', async () => {
  //   const selectedFilter = filterValues[3];
  //   const selectedTarget = targetValues[0];

  //   render(
  //     <TargetAudienceFilterComponent
  //       onSaveFilter={onSaveFilter}
  //       onCloseFilter={onCLoseFilter}
  //     />,
  //   );

  //   await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
  //   const selectedTargetOption = screen.getByText(selectedTarget);
  //   await userEvent.click(selectedTargetOption);

  //   await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
  //   const selectedFilterOption = screen.getByText(selectedFilter);
  //   await userEvent.click(selectedFilterOption);

  //   const iconCheck = screen.getByTestId('save-filter');
  //   await userEvent.click(iconCheck);

  //   expect(onSaveFilter).toHaveBeenCalledWith({
  //     source: selectedTarget,
  //     filterFunction: selectedFilter,
  //     filterParams: [],
  //   });
  // });

  it('fires onSaveFilter method if click on check icon with regex value', async () => {
    const selectedFilter = getFilterLabel(filterValues[2]);
    const selectedTarget = targetValues[0];

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    if (!screen.queryByText(selectedTarget)) {
      await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    }
    await userEvent.click(screen.getByText(selectedTarget));

    await userEvent.click(screen.getByTestId('open-filter-dropdown-filterFns'));
    await userEvent.click(screen.getByText(selectedFilter));

    const input = screen.getByPlaceholderText('Enter regular expression...');
    await userEvent.type(input, 'Developer.*');

    const iconCheck = screen.getByTestId('save-filter');
    await userEvent.click(iconCheck);

    expect(onSaveFilter).toHaveBeenCalledWith({
      source: selectedTarget,
      filterFunction: PublicationFunctions.Regex,
      filterParams: ['Developer.*'],
    });
  });

  it('disables save and shows error message when regex pattern is invalid', async () => {
    const selectedTarget = targetValues[0];
    const selectedFilter = getFilterLabel(filterValues[2]);

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    if (!screen.queryByText(selectedTarget)) {
      await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    }
    await userEvent.click(screen.getByText(selectedTarget));

    await userEvent.click(screen.getByTestId('open-filter-dropdown-filterFns'));
    await userEvent.click(screen.getByText(selectedFilter));

    const input = screen.getByPlaceholderText('Enter regular expression...');
    fireEvent.change(input, { target: { value: '[unclosed' } });

    expect(screen.getByTestId('save-filter')).toBeDisabled();
    expect(screen.getByText('Invalid regular expression')).toBeInTheDocument();
  });

  it('disables save when regex input is whitespace only', async () => {
    const selectedTarget = targetValues[0];
    const selectedFilter = getFilterLabel(filterValues[2]);

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    if (!screen.queryByText(selectedTarget)) {
      await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    }
    await userEvent.click(screen.getByText(selectedTarget));

    await userEvent.click(screen.getByTestId('open-filter-dropdown-filterFns'));
    await userEvent.click(screen.getByText(selectedFilter));

    const input = screen.getByPlaceholderText('Enter regular expression...');
    await userEvent.type(input, '   ');

    expect(screen.getByTestId('save-filter')).toBeDisabled();
  });

  it('re-enables save when valid pattern follows invalid one', async () => {
    const selectedTarget = targetValues[0];
    const selectedFilter = getFilterLabel(filterValues[2]);

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    if (!screen.queryByText(selectedTarget)) {
      await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    }
    await userEvent.click(screen.getByText(selectedTarget));

    await userEvent.click(screen.getByTestId('open-filter-dropdown-filterFns'));
    await userEvent.click(screen.getByText(selectedFilter));

    const input = screen.getByPlaceholderText('Enter regular expression...');
    fireEvent.change(input, { target: { value: '[unclosed' } });
    expect(screen.getByTestId('save-filter')).toBeDisabled();

    fireEvent.change(input, { target: { value: '^admin.*' } });

    expect(screen.getByTestId('save-filter')).not.toBeDisabled();
    expect(
      screen.queryByText('Invalid regular expression'),
    ).not.toBeInTheDocument();
  });

  it('calls onCloseFilter when pointerdown happens outside the filter row and draft is incomplete', () => {
    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    fireEvent.pointerDown(document.body, { bubbles: true });

    expect(onCLoseFilter).toHaveBeenCalled();
  });
});
