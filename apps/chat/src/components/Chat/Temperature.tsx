import { IconHelp } from '@tabler/icons-react';
import {
  FC,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  TouchEventHandler,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { DEFAULT_TEMPERATURE } from '@/src/constants/default-ui-settings';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import Tooltip from '@/src/components/Common/Tooltip';

import { DisableOverlay } from '../Common/DisableOverlay';

import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { HandleProps } from 'rc-slider/lib/Handles/Handle';

interface TemperatureIndicatorProps extends HandleProps {
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  onTouchStart: TouchEventHandler<HTMLDivElement>;
  children: ReactNode;
}

const TemperatureIndicator = ({
  style,
  onKeyDown,
  onMouseDown,
  onTouchStart,
  children,
}: TemperatureIndicatorProps) => {
  return (
    <div
      className="absolute top-[calc(50%-20px)] flex size-10 cursor-pointer items-center justify-center rounded-full bg-layer-3 shadow"
      style={style}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {children}
    </div>
  );
};

interface Props {
  label?: string;
  temperature: number | undefined;
  onChangeTemperature: (temperature: number) => void;
  disabled?: boolean;
}

export const TemperatureSlider: FC<Props> = ({
  label,
  onChangeTemperature,
  temperature,
  disabled,
}) => {
  const [currentTemperature, setCurrentTemperature] = useState<number>(() => {
    return temperature ?? DEFAULT_TEMPERATURE;
  });
  const { t } = useTranslation(Translation.Chat);

  const handleChange = (value: number) => {
    setCurrentTemperature(value);
    onChangeTemperature(value);
  };

  return (
    <div className="flex flex-col gap-2" data-qa="temp-slider">
      {!!label && (
        <div className="flex items-center gap-2">
          <label className="text-left">{label}</label>
          <Tooltip
            contentClassName="max-w-[220px]"
            triggerClassName="text-secondary"
            tooltip={
              <EntityMarkdownDescription>
                {t(
                  'Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.',
                )}
              </EntityMarkdownDescription>
            }
          >
            <IconHelp size={18} />
          </Tooltip>
        </div>
      )}
      <div className="relative px-5">
        {disabled && <DisableOverlay />}
        <Slider
          className="temperature-slider !h-10"
          value={temperature}
          onChange={(value) => typeof value === 'number' && handleChange(value)}
          min={0}
          max={1}
          step={0.1}
          handleRender={({ props }) => (
            <TemperatureIndicator {...(props as TemperatureIndicatorProps)}>
              {currentTemperature}
            </TemperatureIndicator>
          )}
        />
      </div>
      <div className="grid h-4 w-full grid-cols-3 text-xs">
        <span className="">{t('Precise')}</span>
        <span className="text-center">{t('Neutral')}</span>
        <span className="text-right">{t('Creative')}</span>
      </div>
    </div>
  );
};
