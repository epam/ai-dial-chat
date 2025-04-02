import { Editor, EditorProps } from '@monaco-editor/react';
import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react';
import { memo, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { dispatchMouseLeaveEvent } from '@/src/utils/app/common';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import Tooltip from '@/src/components/Common/Tooltip';

import omit from 'lodash-es/omit';

const editorOptions: EditorProps['options'] = {
  minimap: {
    enabled: false,
  },
  padding: {
    top: 12,
    bottom: 12,
  },
  scrollBeyondLastLine: false,
  scrollbar: {
    alwaysConsumeMouseWheel: false,
  },
  automaticLayout: true,
};

interface MonacoEditorProps extends EditorProps {
  allowFullScreen?: boolean;
}

export const MonacoEditor = memo(function MonacoEditor(
  props: MonacoEditorProps,
) {
  const { t } = useTranslation(Translation.Common);

  const theme = useAppSelector(UISelectors.selectThemeState);

  const [isFullScreen, setIsFullScreen] = useState(false);

  const wrapperStyles = useMemo(
    () =>
      isFullScreen
        ? undefined
        : {
            width: props.width ?? '100%',
            height: props.height ?? '100%',
          },
    [isFullScreen, props.width, props.height],
  );

  const FullScreenIcon = useMemo(
    () => (isFullScreen ? IconArrowsMinimize : IconArrowsMaximize),
    [isFullScreen],
  );

  return (
    <div
      style={wrapperStyles}
      className={classNames('flex flex-col overflow-hidden', {
        ['!fixed left-0 top-0 z-40 h-[100vh] w-[100vw]']: isFullScreen,
        ['rounded border border-tertiary bg-layer-3']: props.allowFullScreen,
      })}
    >
      {props.allowFullScreen && (
        <div className="flex justify-end divide-y border-b border-tertiary">
          <Tooltip tooltip={t(isFullScreen ? 'Minimize' : 'Full screen')}>
            <button
              type="button"
              className="p-2 text-secondary hover:text-accent-primary"
              onClick={(e) => {
                setIsFullScreen(!isFullScreen);
                dispatchMouseLeaveEvent(e);
              }}
            >
              <FullScreenIcon size={18} />
            </button>
          </Tooltip>
        </div>
      )}

      <div
        className={classNames('min-h-0 min-w-0 max-w-full shrink grow', {
          ['p-2']: props.allowFullScreen,
        })}
      >
        <Editor
          options={{ ...editorOptions, ...props.options }}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          {...omit(props, ['options', 'width', 'height'])}
          width="100%"
          height="100%"
        />
      </div>
    </div>
  );
});
