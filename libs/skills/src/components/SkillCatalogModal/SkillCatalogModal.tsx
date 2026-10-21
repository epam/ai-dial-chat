import { Popup, PopupSize } from '@epam/ai-dial-ui-kit';
import { Suspense, type FC } from 'react';
import type { SkillCatalogModalProps } from '../../models/skill-catalog-modal-props';

/** "Use skill" browse-modal shell: a large popup hosting host-rendered picker content, mounted only while open. */
export const SkillCatalogModal: FC<SkillCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title,
  renderContent,
}) => (
  <Popup
    open={isOpen}
    header={title}
    size={PopupSize.Lg}
    /* Full-screen at mobile: the overlay padding is dropped and the panel
     * fills the viewport edge-to-edge. Desktop keeps the large centered popup. */
    className="h-[min(90vh,860px)] max-w-[min(95vw,1200px)]! overflow-hidden mobile:h-full mobile:max-w-full! mobile:rounded-none"
    overlayClassName="mobile:p-0"
    onClose={onClose}
  >
    <div className="h-[min(80vh,840px)] overflow-auto mobile:h-full">
      <Suspense fallback={null}>
        {isOpen && renderContent(onSelect, onClose)}
      </Suspense>
    </div>
  </Popup>
);
