import { signIn, signOut, useSession } from 'next-auth/react';
import { ReactNode, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import Select, {
  ClassNamesConfig,
  DropdownIndicatorProps,
  OptionProps,
  ValueContainerProps,
  components,
} from 'react-select';

import HomeContext from '@/pages/api/home/home.context';

import ChevronDownIcon from '../../public/images/icons/chevron-down.svg';
import FileArrowRightIcon from '../../public/images/icons/file-arrow-right.svg';
import GearIcon from '../../public/images/icons/gear.svg';
import UserIcon from '../../public/images/icons/user.svg';
import SVGIcon from '../SVGIcon/SVGIcon';

interface SelectOption {
  label: 'Settings' | 'Log Out';
  value: 'settings' | 'log out';
}

interface OptionComponentProps {
  children: ReactNode;
}
const userOptions: SelectOption[] = [
  { label: 'Settings', value: 'settings' },
  { label: 'Log Out', value: 'log out' },
];
const LogoutOption = ({ children }: OptionComponentProps) => {
  const { data: session } = useSession();
  const onClick = useCallback(() => {
    session
      ? signOut({ redirect: true })
      : signIn('azure-ad', { redirect: true });
  }, [session]);
  return (
    <div className="flex text-gray-500 dark:text-gray-200" onClick={onClick}>
      <SVGIcon
        width={18}
        height={18}
        stroke="currentColor"
        SVGElement={FileArrowRightIcon}
      />
      <span className="ml-3">{children}</span>
    </div>
  );
};

const SettingsOption = ({ children }: OptionComponentProps) => {
  const { dispatch: homeDispatch } = useContext(HomeContext);
  const onClick = () => {
    homeDispatch({ field: 'isUserSettingsOpen', value: true });
  };

  return (
    <div className="flex text-gray-500 dark:text-gray-200" onClick={onClick}>
      <SVGIcon
        width={18}
        height={18}
        stroke="currentColor"
        SVGElement={GearIcon}
      />
      <span className="ml-3">{children}</span>
    </div>
  );
};
const CustomSelectOption = (props: OptionProps<SelectOption>) => {
  const { t } = useTranslation('sidebar');
  const { children, isFocused, data, isSelected } = props;

  return (
    <components.Option
      {...props}
      className={`!p-3 hover:cursor-pointer ${
        isFocused && '!bg-blue/20 dark:!bg-blue/20'
      } ${isSelected && '!bg-transparent'}`}
    >
      {data.label === 'Settings' && (
        <SettingsOption>{t('{{name}}', { name: children })}</SettingsOption>
      )}
      {data.label === 'Log Out' && (
        <LogoutOption>{t('{{name}}', { name: children })}</LogoutOption>
      )}
    </components.Option>
  );
};
const ValueContainer = (props: ValueContainerProps<SelectOption>) => {
  const { data: session } = useSession();
  return (
    <components.ValueContainer
      {...props}
      className="!flex text-gray-500 dark:text-gray-200"
    >
      <SVGIcon
        width={24}
        height={24}
        stroke="currentColor"
        SVGElement={UserIcon}
      />
      <span className="ml-3 mr-2 grow">{session?.user?.name}</span>
    </components.ValueContainer>
  );
};

const DropdownIndicator = (props: DropdownIndicatorProps<SelectOption>) => {
  return (
    <components.DropdownIndicator {...props} className="cursor-pointer">
      <SVGIcon
        className="text-gray-500 dark:!text-gray-200"
        width={18}
        height={18}
        stroke="currentColor"
        SVGElement={ChevronDownIcon}
      />
    </components.DropdownIndicator>
  );
};

const selectClassNames: ClassNamesConfig<SelectOption> = {
  control: () => '!border-none dark:bg-gray-700 !rounded-none',
  indicatorSeparator: () => 'hidden',
  menu: () => 'dark:bg-black !z-50 !mt-0',
  menuList: () => '!p-0',
};
export const User = () => {
  return (
    <Select<SelectOption>
      isSearchable={false}
      options={userOptions}
      components={{
        ValueContainer: ValueContainer,
        DropdownIndicator: DropdownIndicator,
        Option: CustomSelectOption,
      }}
      classNames={selectClassNames}
    />
  );
};
