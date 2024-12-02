import {
  IconEdit,
  IconPlayerPlay,
  IconTrashX,
  IconWorldShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import Tooltip from '../../Common/Tooltip';
import { ApplicationDetailsContent } from '../../Marketplace/ApplicationDetails/ApplicationContent';
import { ApplicationDetailsHeader } from '../../Marketplace/ApplicationDetails/ApplicationHeader';
import { FormData } from './form';

interface GeneralInfoPreviewProps {
  data: FormData;
}

export const GeneralInfoPreview = ({ data }: GeneralInfoPreviewProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const entity = useMemo(() => {
    return {
      ...data,
      type: EntityType.Application,
      isDefault: true,
      reference: '',
      id: '',
    };
  }, [data]);
  return (
    <div className="flex size-full max-w-[1000px] flex-col overflow-hidden p-6">
      <h2 className="mb-4">Preview</h2>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[700px] flex-col divide-y divide-tertiary overflow-y-auto bg-blackout bg-layer-3 p-3 md:p-5 xl:max-w-[720px]">
          <ApplicationDetailsHeader entity={entity} isMobileView={false} />
          {entity.description && <ApplicationDetailsContent entity={entity} />}
          <section className="flex px-3 py-4 md:px-6">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="icon-button" data-qa="application-delete">
                  <IconTrashX size={24} />
                </button>

                <button className="icon-button" data-qa="application-publish">
                  <IconWorldShare size={24} />
                </button>
                <Tooltip tooltip={t('Edit')}>
                  <button className="icon-button" data-qa="application-edit">
                    <IconEdit size={24} />
                  </button>
                </Tooltip>
              </div>
              <div className="flex w-full items-center justify-end gap-4">
                {entity.version && (
                  <div
                    className={classNames('flex gap-2 truncate')}
                    data-qa="version"
                  >
                    <div className="flex items-center gap-2">
                      <span className="hidden md:block">{t('Version: ')}</span>
                      <span className="md:hidden">{t('v: ')}</span>
                    </div>
                    {entity.version}
                  </div>
                )}

                <button
                  className="button button-primary flex shrink-0 items-center gap-2"
                  data-qa="use-button"
                >
                  <IconPlayerPlay size={18} />
                  <span className="hidden md:block">
                    {t('Use {{modelType}}', {
                      modelType: entity.type,
                    })}
                  </span>
                  <span className="block md:hidden">{t('Use')}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
