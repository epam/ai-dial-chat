import { DialPopup, PopupSize } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { DeploymentSelectorI18nKeys } from '../../constants/translation-keys';

const CatalogView = lazy(async () => {
  const module = await import('../CatalogView/CatalogView');
  return { default: module.default };
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CatalogModal: FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  return (
    <DialPopup
      open={isOpen}
      header={t(DeploymentSelectorI18nKeys.Title)}
      size={PopupSize.Lg}
      className="h-[min(90vh,860px)] !max-w-[min(95vw,1200px)] overflow-hidden"
      dividers={false}
      onClose={onClose}
    >
      <div className="h-full overflow-auto">
        <Suspense fallback={null}>
          {isOpen && <CatalogView isSelectorMode onClose={onClose} />}
        </Suspense>
      </div>
    </DialPopup>
  );
};

export default memo(CatalogModal);
