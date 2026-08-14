import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { Popup, PopupSize } from '@epam/ai-dial-ui-kit';
import { Suspense, lazy, memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PromptSelectorI18nKeys } from '../../constants/translation-keys';

const CatalogView = lazy(async () => {
  const module = await import('../CatalogView/CatalogView');
  return { default: module.default };
});

/* Stable identity so CatalogView's selector-mode filter doesn't rebuild every render. */
const PROMPT_ONLY_TYPES = new Set<CatalogEntityType>([
  CatalogEntityType.Prompt,
]);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the selected prompt's id when a card is picked. */
  onSelect: (id: string) => void;
}

/** "Use prompt" picker modal: the Catalog picker shell restricted to prompts only. */
const PromptCatalogModal: FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();

  return (
    <Popup
      open={isOpen}
      header={t(PromptSelectorI18nKeys.ModalTitle)}
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
              visibleTypes={PROMPT_ONLY_TYPES}
            />
          )}
        </Suspense>
      </div>
    </Popup>
  );
};

export default memo(PromptCatalogModal);
