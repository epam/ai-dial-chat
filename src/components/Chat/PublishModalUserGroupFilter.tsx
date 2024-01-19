import { useCallback } from 'react';

import { UserGroup } from '@/src/types/share';

import { MultipleComboBox } from '../Common/MultipleComboBox';

//TODO change to the real API call
const userGroupsMock: UserGroup[] = [
  { id: 'users-1', name: 'Users 1' },
  { id: 'users-2', name: 'Users 2' },
  { id: 'users-3', name: 'Users 3' },
  { id: 'users-4', name: 'Users 4' },
  { id: 'users-5', name: 'Users 5' },
  { id: 'users-6', name: 'Users 6' },
  { id: 'users-7', name: 'Users 7' },
];

//TODO remove from the file

function getFilteredItems<T>(
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
  onChangeUserGroups: (userGroups: UserGroup[]) => void;
}

const getItemValue = (item: UserGroup): string => item.id;
const getItemLabel = (item: UserGroup): string => item.name;

export function PublishModalUserGroupFilter({ onChangeUserGroups }: Props) {
  const handleOnUserGroupsChange = useCallback(
    (newSelectedItems: UserGroup[]) => {
      onChangeUserGroups(newSelectedItems);
    },
    [onChangeUserGroups],
  );

  return (
    <MultipleComboBox
      items={userGroupsMock}
      getItemLabel={getItemLabel}
      getItemValue={getItemValue}
      getFilteredItems={getFilteredItems<UserGroup>}
      onChangeSelectedItems={handleOnUserGroupsChange}
    />
  );
}
