import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react';
import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { dispatchMouseLeaveEvent } from '@/src/utils/app/common';

import { Translation } from '@/src/types/translation';

import { CodeEditorActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { CodeEditorEditorArea } from './CodeEditorEditorArea';
import { CodeEditorSidebar } from './CodeEditorSidebar';

import MoveRightIcon from '@/public/images/icons/move-right.svg';
import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';

interface Props {
  sourcesFolderId: string | undefined;
  readOnly?: boolean;
  reviewBucket?: string;
}

export const CodeEditor = ({
  sourcesFolderId,
  readOnly,
  reviewBucket,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    window.addEventListener('keydown', handleEscapeKey);

    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isFullScreen]);

  useEffect(() => {
    if (sourcesFolderId) {
      dispatch(CodeEditorActions.initCodeEditor({ sourcesFolderId }));
    }
  }, [dispatch, sourcesFolderId]);

  const handleSidebarToggle = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsSidebarOpen((prev) => !prev);
    },
    [],
  );

  const FullScreenIcon = useMemo(
    () => (isFullScreen ? IconArrowsMinimize : IconArrowsMaximize),
    [isFullScreen],
  );

  if (!sourcesFolderId) {
    return null;
  }

  return (
    <div className="z-40 w-full max-w-full">
      <div
        className={classNames(
          'grid min-h-[400px] w-full max-w-full grid-rows-[100%]',
          isFullScreen ? 'fixed inset-0 z-50' : 'h-[400px]',
          isSidebarOpen ? 'grid-cols-[220px_1fr]' : 'grid-cols-[0px_1fr]',
        )}
      >
        <CodeEditorSidebar
          sourcesFolderId={sourcesFolderId}
          readOnly={readOnly}
          reviewBucket={reviewBucket}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
        />
        <div className="flex max-h-full min-w-0 flex-col divide-y divide-tertiary rounded-r border border-tertiary bg-layer-3">
          <div
            className={classNames(
              'flex w-full shrink-0',
              isSidebarOpen ? 'justify-end' : 'justify-between',
            )}
          >
            {!isSidebarOpen && (
              <div className="flex w-fit border-r border-tertiary px-3 py-2">
                <DialGhostIconButton
                  tooltipProps={{
                    tooltip: t(ChatI18nKeys.ShowFileList),
                    isTriggerClickable: true,
                    triggerClassName: 'mr-auto',
                  }}
                  size={ElementSize.Small}
                  onClick={handleSidebarToggle}
                  icon={<MoveRightIcon size={DEFAULT_ICON_SIZES.SMALL} />}
                />
              </div>
            )}

            <div className="flex w-fit border-l border-tertiary px-3 py-2">
              <DialGhostIconButton
                tooltipProps={{
                  tooltip: t(
                    isFullScreen
                      ? ChatI18nKeys.Minimize
                      : ChatI18nKeys.FullScreenLabel,
                  ),
                }}
                size={ElementSize.Small}
                onClick={(e) => {
                  setIsFullScreen(!isFullScreen);
                  dispatchMouseLeaveEvent(e);
                }}
                icon={<FullScreenIcon size={DEFAULT_ICON_SIZES.SMALL} />}
              />
            </div>
          </div>
          <div className="min-h-0 min-w-0 max-w-full shrink grow p-3">
            <CodeEditorEditorArea readOnly={readOnly} />
          </div>
        </div>
      </div>
    </div>
  );
};
