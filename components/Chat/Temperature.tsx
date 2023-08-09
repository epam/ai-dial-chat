import { FC, useContext, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { DEFAULT_TEMPERATURE } from '@/utils/app/const';

import { Conversation } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

interface Props {
  label: string;
  onChangeTemperature: (temperature: number) => void;
  conversation: Conversation;
}

export const TemperatureSlider: FC<Props> = ({
  label,
  onChangeTemperature,
  conversation,
}) => {
  const {
    state: { conversations },
  } = useContext(HomeContext);

  const [temperature, setTemperature] = useState<number>(() => {
    const lastConversation = conversations[conversations.length - 1];
    return (
      conversation.temperature ??
      lastConversation?.temperature ??
      DEFAULT_TEMPERATURE
    );
  });
  const { t } = useTranslation('chat');
  const handleChange = (value: number) => {
    const newValue = parseFloat(value);
    setTemperature(newValue);
    onChangeTemperature(newValue);
  };

  const HandleElement = ({ props }: any) => {
    return (
      <div
        className="absolute top-[calc(50%-20px)] flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
        style={props.style}
        onKeyDown={props.onKeyDown}
        onMouseDown={props.onMouseDown}
        onTouchStart={props.onTouchStart}
      >
        {temperature}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-left">{label}</label>
      <span className="text-sm text-gray-500">
        {t(
          'Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.',
        )}
      </span>
      <div className="grid h-4 w-full grid-cols-3 text-xs">
        <span className="">{t('Precise')}</span>
        <span className="text-center">{t('Neutral')}</span>
        <span className="text-right">{t('Creative')}</span>
      </div>

      <Slider
        className="temperature-slider !h-10"
        value={temperature}
        onChange={(value) => typeof value === 'number' && handleChange(value)}
        min={0}
        max={1}
        step={0.1}
        handleRender={HandleElement}
      />
    </div>
  );
};
