import { ReactNode } from 'react';

interface BlackOutModalProps {
  children: ReactNode;
}
export const BlackOutModal = ({ children }: BlackOutModalProps) => {
  return (
    <div
      id="modal-screen"
      className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-gray-900/70"
    >
      {children}
    </div>
  );
};
