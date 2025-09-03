import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
>;

interface Props<T> extends ButtonProps {
  tabKey: T;
  label: string;
  selected?: boolean;
  dataQA?: string;
  onClick: (key: T) => void;
}

export const TabButton = <T,>({
  tabKey,
  label,
  selected,
  dataQA,
  className,
  disabled,
  onClick,
  ...rest
}: Props<T>) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <button
      {...rest}
      className={classNames(
        className,
        'rounded px-3 py-2',
        selected
          ? 'border-accent-primary bg-accent-primary-alpha'
          : 'border-primary bg-layer-4 hover:border-transparent',
        disabled
          ? 'button border-transparent'
          : 'border-b-2 hover:bg-accent-primary-alpha',
      )}
      data-qa={dataQA ?? 'tab-button'}
      disabled={disabled}
      onClick={() => onClick(tabKey)}
    >
      {t(label)}
    </button>
  );
};
