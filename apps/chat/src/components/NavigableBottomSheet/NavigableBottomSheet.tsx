import { BottomSheetShell } from '@epam/ai-dial-conversation-input';
import {
  type FC,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationI18nKeys } from '../../constants/translation-keys';
import { SheetNavigationContext } from '../../context/SheetNavigationContext';
import type { SheetPage } from '../../models/sheet-navigation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Title shown in the root-level header (no back button). Required for accessibility. */
  title: string;
  className?: string;
}

const NavigableBottomSheet: FC<Props> = ({
  isOpen,
  onClose,
  children,
  title,
  className,
}) => {
  const { t } = useTranslation();
  const [stack, setStack] = useState<SheetPage[]>([]);

  useEffect(() => {
    if (!isOpen) setStack([]);
  }, [isOpen]);

  const push = useCallback((page: SheetPage) => {
    setStack((prev) => [...prev, page]);
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const close = useCallback(() => {
    setStack([]);
    onClose();
  }, [onClose]);

  const contextValue = useMemo(
    () => ({ push, pop, close }),
    [push, pop, close],
  );

  const topPage = stack[stack.length - 1];

  return (
    <SheetNavigationContext.Provider value={contextValue}>
      <BottomSheetShell
        isOpen={isOpen}
        onClose={close}
        title={topPage?.title ?? title}
        closeLabel={t(NavigationI18nKeys.Close)}
        onBack={topPage ? pop : undefined}
        backLabel={topPage ? t(NavigationI18nKeys.Back) : undefined}
        className={className}
      >
        {topPage ? topPage.content : children}
      </BottomSheetShell>
    </SheetNavigationContext.Provider>
  );
};

export default memo(NavigableBottomSheet);
