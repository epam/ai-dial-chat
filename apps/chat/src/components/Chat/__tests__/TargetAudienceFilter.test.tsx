import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AnyAction } from '@reduxjs/toolkit';

import { PublicationFunctions } from '@/src/types/publication';

import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { TargetAudienceFilterComponent } from '@/src/components/Chat/Publish/TargetAudienceFilterComponent';

vi.mock('@/src/store/hooks', async () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppSelector: (selector: any) => selector({}),
    useAppDispatch: () => (action: AnyAction) => action,
  };
});

vi.mock('@/src/store/settings/settings.reducers', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await vi.importActual(
    '@/src/store/settings/settings.reducers',
  );
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
  ];

  const defaultFilterOption = 'Select';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);

    for (const option of targetValues) {
      expect(screen.getByText(option)).toBeInTheDocument();
    }

    const selectedTargetOption = screen.getByText(targetValues[0]);
    await userEvent.click(selectedTargetOption);

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);

    for (const option of filterValues) {
      expect(screen.getByText(option)).toBeInTheDocument();
    }

    const selectedFilterOption = screen.getByText(filterValues[1]);
    await userEvent.click(selectedFilterOption);

    expect(screen.queryByText(defaultFilterOption)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter one or more options...'));
  });

  it('selects an filter and target options on click', async () => {
    const selectedFilter = filterValues[1];
    const selectedTarget = targetValues[0];

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    const selectedTargetOption = screen.getByText(selectedTarget);
    await userEvent.click(selectedTargetOption);

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    const selectedFilterOption = screen.getByText(selectedFilter);
    await userEvent.click(selectedFilterOption);

    expect(screen.getByText(selectedFilter)).toBeInTheDocument();
    expect(screen.getByText(selectedTarget)).toBeInTheDocument();
  });

  it('save button is disabled if no targets chosen', async () => {
    const selectedFilter = filterValues[0];
    const selectedTarget = targetValues[0];

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    const selectedTargetOption = screen.getByText(selectedTarget);
    await userEvent.click(selectedTargetOption);

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    const selectedFilterOption = screen.getByText(selectedFilter);
    await userEvent.click(selectedFilterOption);

    const iconCheck = screen.getByTestId('save-filter');

    expect(iconCheck).toBeDisabled();
  });

  it('fires onSaveFilter method if click on check icon with filter params', async () => {
    const selectedFilter = filterValues[1];
    const selectedTarget = targetValues[0];

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    const selectedTargetOption = screen.getByText(selectedTarget);
    await userEvent.click(selectedTargetOption);

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    const selectedFilterOption = screen.getByText(selectedFilter);
    await userEvent.click(selectedFilterOption);

    const combobox = screen.getByRole('combobox');
    await userEvent.type(combobox, 'QA{enter}');
    await userEvent.type(combobox, 'Developer{enter}');
    await userEvent.type(combobox, 'Manager{enter}');

    const iconCheck = screen.getByTestId('save-filter');
    await userEvent.click(iconCheck);

    expect(onSaveFilter).toHaveBeenCalledWith({
      id: selectedTarget,
      filterFunction: selectedFilter,
      filterParams: ['QA', 'Developer', 'Manager'],
    });
  });

  it('fires onSaveFilter method if click on check icon with regex value', async () => {
    const selectedFilter = filterValues[2];
    const selectedTarget = targetValues[0];

    render(
      <TargetAudienceFilterComponent
        onSaveFilter={onSaveFilter}
        onCloseFilter={onCLoseFilter}
      />,
    );

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    const selectedTargetOption = screen.getByText(selectedTarget);
    await userEvent.click(selectedTargetOption);

    await userEvent.click(screen.getAllByText(defaultFilterOption)[0]);
    const selectedFilterOption = screen.getByText(selectedFilter);
    await userEvent.click(selectedFilterOption);

    const input = screen.getByPlaceholderText('Enter regular expression...');
    await userEvent.type(input, 'Developer.*');

    const iconCheck = screen.getByTestId('save-filter');
    await userEvent.click(iconCheck);

    expect(onSaveFilter).toHaveBeenCalledWith({
      id: selectedTarget,
      filterFunction: selectedFilter,
      filterParams: ['Developer.*'],
    });
  });
});
