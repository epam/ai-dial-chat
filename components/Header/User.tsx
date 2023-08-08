import { signIn, signOut, useSession } from 'next-auth/react';
import { ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Select, {
  ClassNamesConfig,
  DropdownIndicatorProps,
  OptionProps,
  ValueContainerProps,
  components,
} from 'react-select';

import Image from 'next/image';

import useOutsideAlerter from '@/hooks/useOutsideAlerter';

import HomeContext from '@/pages/api/home/home.context';

import ChevronDownIcon from '../../public/images/icons/chevron-down.svg';
import ChevronUpIcon from '../../public/images/icons/chevron-up.svg';
import FileArrowRightIcon from '../../public/images/icons/file-arrow-right.svg';
import GearIcon from '../../public/images/icons/gear.svg';
import UserIcon from '../../public/images/icons/user.svg';

interface SelectOption {
  label: 'Settings' | 'Log out';
  value: 'settings' | 'log out';
}

interface OptionComponentProps {
  children: ReactNode;
}
const userOptions: SelectOption[] = [
  { label: 'Settings', value: 'settings' },
  { label: 'Log out', value: 'log out' },
];
const LogoutOption = ({ children }: OptionComponentProps) => {
  const { data: session } = useSession();
  const { t } = useTranslation('sidebar');

  const onClick = useCallback(() => {
    session
      ? signOut({ redirect: true })
      : signIn('azure-ad', { redirect: true });
  }, [session]);
  return (
    <div className="flex text-gray-500 dark:text-gray-200" onClick={onClick}>
      <FileArrowRightIcon width={18} height={18} stroke="currentColor" />
      <span className="ml-3">{session ? children : t('Login')}</span>
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
      <GearIcon width={18} height={18} stroke="currentColor" />
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
        isFocused && '!bg-blue-500/20 dark:!bg-blue-500/20'
      } ${isSelected && '!bg-transparent'}`}
    >
      {data.label === 'Settings' && (
        <SettingsOption>{t('{{name}}', { name: children })}</SettingsOption>
      )}
      {data.label === 'Log out' && (
        <LogoutOption>{t('{{name}}', { name: children })}</LogoutOption>
      )}
    </components.Option>
  );
};
const ValueContainer = (props: ValueContainerProps<SelectOption>) => {
  const { t } = useTranslation('settings');
  const { data: session } = useSession();

  return (
    <components.ValueContainer
      {...props}
      className="!flex cursor-pointer bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
    >
      {session?.user?.image ? (
        <Image
          className="rounded"
          src={session?.user?.image}
          width={18}
          height={18}
          alt={t(`User avatar`)}
        />
      ) : (
        <UserIcon width={18} height={18} stroke="currentColor" />
      )}

      <span className="ml-3 mr-2 grow">{session?.user?.name}</span>
    </components.ValueContainer>
  );
};

const DropdownIndicator = (props: DropdownIndicatorProps<SelectOption>) => {
  return (
    <components.DropdownIndicator {...props} className="cursor-pointer">
      {props.selectProps.menuIsOpen ? (
        <ChevronUpIcon
          className="text-gray-800 dark:!text-gray-200"
          width={18}
          height={18}
          stroke="currentColor"
        />
      ) : (
        <ChevronDownIcon
          className="text-gray-800 dark:!text-gray-200"
          width={18}
          height={18}
          stroke="currentColor"
        />
      )}
    </components.DropdownIndicator>
  );
};

const selectClassNames: ClassNamesConfig<SelectOption> = {
  control: () => '!border-none dark:bg-gray-700 !rounded-none h-full',
  indicatorSeparator: () => 'hidden',
  menu: () => 'dark:bg-black !z-50 !rounded-none',
  menuList: () => '!p-0',
};
export const User = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideAlerter(ref, setOpen);
  return (
    <div
      onClick={() => {
        setOpen((prev) => !prev);
      }}
      className="flex"
      ref={ref}
    >
      <Select<SelectOption>
        isClearable={false}
        menuIsOpen={open}
        isSearchable={false}
        options={userOptions}
        components={{
          ValueContainer: ValueContainer,
          DropdownIndicator: DropdownIndicator,
          Option: CustomSelectOption,
        }}
        classNames={selectClassNames}
      />
    </div>
  );
};
