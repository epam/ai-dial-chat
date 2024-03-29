import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { UserGroup } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

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

export function UserGroupFilter({
  initialSelectedUserGroups,
  onChangeUserGroups,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

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
      placeholder={t('Enter one or more options...') as string}
      notFoundPlaceholder={t('No user group available') as string}
    />
  );
}
