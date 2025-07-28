import { useTranslation } from 'next-i18next';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface Props {
  path: string;
  handleFolderChange: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const PublishToSection = ({ path, handleFolderChange }: Props) => {
  const { t } = useTranslation();

  return (
    <section className="mb-3">
      <h3
        className="mb-1 flex text-xs text-secondary"
        data-qa="publish-to-label"
      >
        {t('Publish to')}
      </h3>
      <div
        className="input-form button mx-0 flex grow cursor-default items-center border-primary px-3 py-2"
        data-qa="change-path-container"
      >
        <div className="flex w-full justify-between truncate whitespace-pre break-all">
          <Tooltip
            tooltip={path}
            triggerClassName="truncate whitespace-pre"
            contentClassName="break-all"
            dataQa="path"
          >
            {path}
          </Tooltip>

          <button
            className="h-full cursor-pointer text-accent-primary"
            data-qa="change-button"
            onClick={handleFolderChange}
          >
            {t('Change')}
          </button>
        </div>
      </div>
    </section>
  );
};
