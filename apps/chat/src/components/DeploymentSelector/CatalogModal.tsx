import { Popup, PopupSize } from '@epam/ai-dial-ui-kit';
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
  /**
   * Called with the selected deployment's id when a card is picked, instead
   * of committing the pick to `DeploymentsContext`. Omit to keep the
   * default behavior (updates the chat input's own selected deployment).
   */
  onSelect?: (id: string) => void;
}

const CatalogModal: FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();

  return (
    <Popup
      open={isOpen}
      header={t(DeploymentSelectorI18nKeys.Title)}
      size={PopupSize.Lg}
      className="h-[min(90vh,860px)] !max-w-[min(95vw,1200px)] overflow-hidden"
      onClose={onClose}
    >
      <div className="h-[min(80vh,840px)] overflow-auto">
        <Suspense fallback={null}>
          {isOpen && (
            <CatalogView isSelectorMode onClose={onClose} onSelect={onSelect} />
          )}
        </Suspense>
      </div>
    </Popup>
  );
};

export default memo(CatalogModal);
