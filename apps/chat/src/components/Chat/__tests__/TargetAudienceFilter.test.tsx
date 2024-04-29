import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PublicationFunctions } from '@/src/types/publication';

import { TargetAudienceFilterComponent } from '@/src/components/Chat/Publish/TargetAudienceFilter';

describe('TargetAudienceFilterComponent', () => {
  const testFilter = {
    id: 'testFilter',
    name: 'Test filter',
  };

  const filterValues = [
    PublicationFunctions.CONTAIN,
    PublicationFunctions.EQUAL,
    PublicationFunctions.REGEX,
    PublicationFunctions.FALSE,
    PublicationFunctions.TRUE,
  ];

  const defaultFilterOption = PublicationFunctions.CONTAIN;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let onChangeFilter: any;

  beforeEach(() => {
    onChangeFilter = vi.fn();
    vi.clearAllMocks();
  });

  it('renders all filter options and placeholder correctly', async () => {
    render(
      <TargetAudienceFilterComponent
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
    expect(screen.getByPlaceholderText('Enter one or more options...'));
  });

  it('selects an filter option on click', async () => {
    const selectedVlaue = filterValues[1];
    render(
      <TargetAudienceFilterComponent
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

  it('fires onChangeFilter method on filter option selection', async () => {
    const selectedVlaue = filterValues[1];
    render(
      <TargetAudienceFilterComponent
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

  it('fires onChangeFilter method on "Enter"', async () => {
    render(
      <TargetAudienceFilterComponent
        id={testFilter.id}
        name={testFilter.name}
        onChangeFilter={onChangeFilter}
      />,
    );

    const combobox = screen.getByRole('combobox');
    await userEvent.type(combobox, 'QA{enter}');
    expect(onChangeFilter).toHaveBeenCalledWith({
      id: testFilter.id,
      name: testFilter.name,
      filterType: defaultFilterOption,
      filterParams: ['QA'],
    });
    await userEvent.type(combobox, 'BA{enter}');
    expect(onChangeFilter).toHaveBeenCalledTimes(2);
    expect(onChangeFilter).toHaveBeenCalledWith({
      id: testFilter.id,
      name: testFilter.name,
      filterType: defaultFilterOption,
      filterParams: ['QA', 'BA'],
    });
  });

  it.skip('fires onChangeFilter method on changing input when Regex selected', async () => {
    const selectedVlaue = PublicationFunctions.REGEX;
    const regEx = '/testd?/i';
    render(
      <TargetAudienceFilterComponent
        id={testFilter.id}
        name={testFilter.name}
        onChangeFilter={onChangeFilter}
      />,
    );
    await userEvent.click(screen.getByText(defaultFilterOption));

    const selectedFilterOption = screen.getByText(selectedVlaue);

    await userEvent.click(selectedFilterOption);

    const regExInput = screen.getByPlaceholderText(
      'Enter regular expression...',
    );
    await userEvent.type(regExInput, regEx);
    expect(onChangeFilter).toHaveBeenCalledWith({
      id: testFilter.id,
      name: testFilter.name,
      filterType: PublicationFunctions.REGEX,
      filterParams: [regEx],
    });
  });
});
