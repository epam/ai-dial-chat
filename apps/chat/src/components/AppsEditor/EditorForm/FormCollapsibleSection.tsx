import { IconChevronDown } from '@tabler/icons-react';
import { ReactNode, useCallback, useState } from 'react';

import classNames from 'classnames';

import { DialButton } from '@epam/ai-dial-ui-kit';

interface FormSectionProps {
  name: string;
  children: ReactNode;
  openByDefault?: boolean;
  description?: ReactNode;
  dataQa?: string;
}

export const FormCollapsibleSection = ({
  name,
  children,
  openByDefault = false,
  description,
  dataQa,
}: FormSectionProps) => {
  const [isOpen, setIsOpen] = useState(openByDefault);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex flex-col px-5 py-4" data-qa={dataQa}>
      <DialButton
        onClick={handleToggle}
        className="flex h-fit items-center gap-2 px-0 text-base font-semibold"
        aria-expanded={isOpen}
        label={name}
        iconBefore={
          <IconChevronDown
            className={classNames('duration-200', !isOpen && '-rotate-90')}
            size={20}
          />
        }
      />
      {description && (
        <p className="ms-7 mt-2 text-sm text-secondary">{description}</p>
      )}
      {isOpen && (
        <div className="ms-7 mt-4 flex flex-col gap-4">{children}</div>
      )}
    </div>
  );
};
