import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { Popup, PopupSize } from '@epam/ai-dial-ui-kit';
import { Suspense, lazy, memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { SkillSelectorI18nKeys } from '../../constants/translation-keys';

const CatalogView = lazy(async () => {
  const module = await import('../CatalogView/CatalogView');
  return { default: module.default };
});

/* Stable identity so CatalogView's selector-mode filter doesn't rebuild every render. */
const SKILL_ONLY_TYPES = new Set<CatalogEntityType>([CatalogEntityType.Skill]);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the selected skill's id (its `skills/{bucket}/{path}` URL) when a card is picked. */
  onSelect: (id: string) => void;
}

/** "Use skill" picker modal: the Catalog picker shell restricted to skills only. */
const SkillCatalogModal: FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();

  return (
    <Popup
      open={isOpen}
      header={t(SkillSelectorI18nKeys.ModalTitle)}
      size={PopupSize.Lg}
      className="h-[min(90vh,860px)] !max-w-[min(95vw,1200px)] overflow-hidden"
      onClose={onClose}
    >
      <div className="h-[min(80vh,840px)] overflow-auto">
        <Suspense fallback={null}>
          {isOpen && (
            <CatalogView
              isSelectorMode
              onClose={onClose}
              onSelect={onSelect}
              visibleTypes={SKILL_ONLY_TYPES}
            />
          )}
        </Suspense>
      </div>
    </Popup>
  );
};

export default memo(SkillCatalogModal);
