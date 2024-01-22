import { useCallback } from 'react';

import { UserGroup } from '@/src/types/share';

import { MultipleComboBox } from '../../Common/MultipleComboBox';

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

interface Props {
  initialSelectedUserGroups: UserGroup[];
  onChangeUserGroups: (userGroups: UserGroup[]) => void;
}

const getItemValue = (item: UserGroup): string => item.id;
const getItemLabel = (item: UserGroup): string => item.name;

export function PublishModalUserGroupFilter({
  initialSelectedUserGroups,
  onChangeUserGroups,
}: Props) {
  const handleOnUserGroupsChange = useCallback(
    (newSelectedItems: UserGroup[]) => {
      onChangeUserGroups(newSelectedItems);
    },
    [onChangeUserGroups],
  );

  return (
    <MultipleComboBox
      items={userGroupsMock}
      initialSelectedItems={initialSelectedUserGroups}
      getItemLabel={getItemLabel}
      getItemValue={getItemValue}
      onChangeSelectedItems={handleOnUserGroupsChange}
    />
  );
}
