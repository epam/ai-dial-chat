import { useEffect, useRef } from 'react';

export const useDocumentBody = () => {
  const bodyRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    bodyRef.current = document.body;
  }, []);
  return bodyRef;
};
