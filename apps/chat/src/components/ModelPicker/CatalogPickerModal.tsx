import { DialPopup, PopupSize } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { Suspense, lazy } from 'react';

const CatalogView = lazy(async () => {
  const module = await import('../CatalogView/CatalogView');
  return { default: module.default };
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CatalogPickerModal: FC<Props> = ({ isOpen, onClose }) => (
  <DialPopup
    open={isOpen}
    size={PopupSize.Lg}
    className="h-[min(90vh,860px)] !max-w-[min(95vw,1200px)] overflow-hidden"
    dividers={false}
    onClose={onClose}
  >
    <div className="h-full overflow-auto">
      <Suspense fallback={null}>
        {isOpen && <CatalogView />}
      </Suspense>
    </div>
  </DialPopup>
);

export default memo(CatalogPickerModal);
