import { useCallback } from 'react';

import { UserGoup } from '@/src/types/share';

import { MultipleComboBox } from '../Common/MultipleComboBox';

//TODO change to the real API call
const userGroupsMock: UserGoup[] = [
  { id: 'users-1', name: 'Users 1' },
  { id: 'users-2', name: 'Users 2' },
  { id: 'users-3', name: 'Users 3' },
  { id: 'users-4', name: 'Users 4' },
  { id: 'users-5', name: 'Users 5' },
  { id: 'users-6', name: 'Users 6' },
  { id: 'users-7', name: 'Users 7' },
];

//TODO remove from the file

function getFilteredUserGroups<T>(
  items: T[],
  inputValue: string | undefined,
  getItemLabel: (item: T) => string,
  selectedItems?: T[],
) {
  if (!selectedItems) {
    return items;
  } else {
    const lowerCasedInputValue = inputValue ? inputValue.toLowerCase() : '';
    return items.filter(
      (item) =>
        !selectedItems.includes(item) &&
        getItemLabel(item).toLowerCase().includes(lowerCasedInputValue),
    );
  }
}
// End of remove from file

interface Props {
  onChangeUserGoups: (userGroups: UserGoup[]) => void;
}

const getItemValue = (item: UserGoup): string => item.id;
const getItemLabel = (item: UserGoup): string => item.name;

export function PublishModalUserGroupFilter({ onChangeUserGoups }: Props) {
  const handleOnUserGroupsChange = useCallback(
    (newSelectedItems: UserGoup[]) => {
      onChangeUserGoups(newSelectedItems);
    },
    [onChangeUserGoups],
  );

  return (
    <MultipleComboBox
      items={userGroupsMock}
      getItemLabel={getItemLabel}
      getItemValue={getItemValue}
      getFilteredItems={getFilteredUserGroups<UserGoup>}
      onChangeSelectedItems={handleOnUserGroupsChange}
    />
  );
}
