import { useCallback, useMemo, useState } from 'react';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { fakeCallback } from '@/src/utils/app/common';

import { PreviewMode } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { ToggleSwitchLabeled } from '@/src/components/Common/ToggleSwitch/ToggleSwitchLabeled';
import { ApplicationDetailsContent } from '@/src/components/Marketplace/ApplicationDetails/ApplicationContent';
import { ApplicationDetailsHeader } from '@/src/components/Marketplace/ApplicationDetails/ApplicationHeader';
import { PreviewModeButton } from '@/src/components/Marketplace/MarketplaceEditorView/PreviewModeButton';
import { MarketplaceEntityCard } from '@/src/components/Marketplace/MarketplaceEntitiesList/MarketplaceEntitiesTiles/MarketplaceEntityCard';

interface GeneralPreviewProps {
  entity: DialAIEntityModel;
  dataQA?: string;
}

export const GeneralPreview = ({ entity, dataQA }: GeneralPreviewProps) => {
  const { t } = useTranslation(Translation.Chat);

  const router = useRouter();
  const { publicationUrl } = router.query;

  const publication = useAppSelector((state) =>
    PublicationSelectors.selectPublicationByUrl(
      state,
      (publicationUrl ?? '') as string,
    ),
  );

  const [isDetailed, setIsDetailed] = useState(true);

  const handleSwitch = useCallback(() => {
    setIsDetailed((p) => !p);
  }, []);

  const cardEntity = useMemo(() => {
    if (publication) {
      return {
        ...entity,
        owner: publication.displayAuthor ?? publication.author,
        createdAt: publication.createdAt,
      };
    }

    return entity;
  }, [entity, publication]);

  return (
    <div
      className="flex h-full flex-col px-5 py-4 xl:p-6"
      data-qa={dataQA ?? 'entity-preview-general-info-full-container'}
    >
      <div
        className="hidden max-w-full items-center justify-between md:flex xl:justify-end"
        data-qa="preview-toggle-container"
      >
        <span className="me-2 flex min-w-0 shrink grow select-none gap-2 text-primary">
          {t(ChatI18nKeys.Preview)}
        </span>
        <div className="w-min border-e border-secondary pe-3 xl:border-none xl:pe-0">
          <ToggleSwitchLabeled
            isOn={isDetailed}
            handleSwitch={handleSwitch}
            labelText={t(ChatI18nKeys.Detailed)}
            isLabelOnRight
            switchOnText={t(ChatI18nKeys.ON)}
            switchOFFText={t(ChatI18nKeys.OFF)}
          />
        </div>
        <PreviewModeButton
          mode={PreviewMode.closed}
          className="hidden ps-3 max-xl:flex"
        />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div
          className="w-full max-w-[700px] xl:max-w-[720px]"
          data-qa="entity-preview-general-info"
        >
          {isDetailed ? (
            <div className="flex w-full flex-col divide-y divide-tertiary rounded bg-layer-3">
              <ApplicationDetailsHeader entity={cardEntity} isPreview />
              <ApplicationDetailsContent entity={cardEntity} />
            </div>
          ) : (
            <MarketplaceEntityCard
              entity={cardEntity}
              onClick={fakeCallback}
              isPreview
              onDelete={fakeCallback}
              onPublish={fakeCallback}
            />
          )}
        </div>
      </div>
      <div className="flex md:hidden">
        <ToggleSwitchLabeled
          isOn={isDetailed}
          handleSwitch={handleSwitch}
          labelText={t(ChatI18nKeys.Detailed)}
          isLabelOnRight
          switchOnText={t(ChatI18nKeys.ON)}
          switchOFFText={t(ChatI18nKeys.OFF)}
        />
      </div>
    </div>
  );
};
