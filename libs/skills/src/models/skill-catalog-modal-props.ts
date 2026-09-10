import type { ReactNode } from 'react';

/** Props for the SkillCatalogModal component. */
export interface SkillCatalogModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Called when the modal should close (close button or backdrop click). */
  onClose: () => void;
  /** Called with the selected skill's resource URL when the content picks one. */
  onSelect: (id: string) => void;
  /** Header title. */
  title: string;
  /**
   * Renders the modal body's picker content, mounted only while the modal is
   * open; receives the selection and close callbacks to wire into it.
   */
  renderContent: (
    onSelect: (id: string) => void,
    onClose: () => void,
  ) => ReactNode;
}
