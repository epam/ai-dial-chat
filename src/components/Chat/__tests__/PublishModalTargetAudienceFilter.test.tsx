import { render, screen } from '@testing-library/react';

import { FiltersTypes } from '@/src/types/share';

import { PublishModalTargetAudienceFilter } from '../PublishModal/TargetAudienceFilter';

import userEvent from '@testing-library/user-event';

describe('PublishModalTargetAudienceFilter', () => {
  const testFilter = {
    id: 'testFilter',
    name: 'Test filter',
  };

  const filterValues = [
    FiltersTypes.Contains,
    FiltersTypes.NotContains,
    FiltersTypes.Equals,
    FiltersTypes.Regex,
  ];

  const defaultFilterOption = FiltersTypes.Contains;

  const onChangeFilter = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all filter options and placeholder correctly', async () => {
    render(
      <PublishModalTargetAudienceFilter
        id={testFilter.id}
        name={testFilter.name}
        onChangeFilter={onChangeFilter}
      />,
    );
    await userEvent.click(screen.getByText(defaultFilterOption));

    for (const option of filterValues) {
      if (option === defaultFilterOption) {
        expect(screen.getAllByText(option)).toHaveLength(2);
      } else {
        expect(screen.getByText(option)).toBeInTheDocument();
      }
    }
    expect(
      screen.getByPlaceholderText(`Enter ${testFilter.name.toLowerCase()}`),
    );
  });

  it('selects an filter option on click', async () => {
    const selectedVlaue = filterValues[1];
    render(
      <PublishModalTargetAudienceFilter
        id={testFilter.id}
        name={testFilter.name}
        onChangeFilter={onChangeFilter}
      />,
    );
    await userEvent.click(screen.getByText(defaultFilterOption));

    const selectedFilterOption = screen.getByText(selectedVlaue);

    await userEvent.click(selectedFilterOption);

    expect(screen.getByText(selectedVlaue)).toBeInTheDocument();
  });

  it('fires onChangeFilter event on filter option selection', async () => {
    const selectedVlaue = filterValues[1];
    render(
      <PublishModalTargetAudienceFilter
        id={testFilter.id}
        name={testFilter.name}
        onChangeFilter={onChangeFilter}
      />,
    );
    await userEvent.click(screen.getByText(defaultFilterOption));

    const selectedFilterOption = screen.getByText(selectedVlaue);

    await userEvent.click(selectedFilterOption);

    expect(onChangeFilter).toHaveBeenCalledTimes(1);
    expect(onChangeFilter).toBeCalledWith({
      id: testFilter.id,
      name: testFilter.name,
      filterType: selectedVlaue,
      filterParams: [],
    });
  });

  it('does not fire onChange event when disabled', async () => {
    render(
      <PublishModalTargetAudienceFilter
        id={testFilter.id}
        name={testFilter.name}
        onChangeFilter={onChangeFilter}
      />,
    );

    await userEvent.type(screen.getByRole('combobox'), 'QA{enter}');
    expect(onChangeFilter).toHaveBeenCalledWith({
      id: testFilter.id,
      name: testFilter.name,
      filterType: defaultFilterOption,
      filterParams: ['QA'],
    });
  });
});
