import { FC } from 'react';

import classNames from 'classnames';

import {
  getFormSchemaPropertyType,
  getSortedFormSchemaProperties,
} from '@/src/utils/app/form-schema';

import { FormSchemaPropertyType } from '@/src/types/form-schema';

import { useAppSelector } from '@/src/store/hooks';
import { ChatSelectors, ModelsSelectors } from '@/src/store/selectors';

import { MessageFormSchema } from '@epam/ai-dial-shared';

interface IntroTextViewProps {
  schema: MessageFormSchema;
  isWideLayout: boolean;
}

const IntroTextView = ({ schema, isWideLayout }: IntroTextViewProps) => {
  const sortedProperties = getSortedFormSchemaProperties(schema);
  const buttonProperty = sortedProperties.find(
    ([name]) =>
      getFormSchemaPropertyType(schema, name) === FormSchemaPropertyType.Button,
  );

  if (!buttonProperty || !buttonProperty[1]?.description) {
    return null;
  }

  return (
    <div
      data-qa="intro-text"
      className={classNames(
        'break-words px-2 text-center text-lg font-semibold md:last:mb-5 lg:mx-auto lg:w-[768px]',
        isWideLayout ? 'mx-4 mt-4' : 'sm:m-4',
      )}
    >
      {buttonProperty[1].description}
    </div>
  );
};

interface Props {
  modelId: string;
  isWideLayout: boolean;
}

export const IntroText: FC<Props> = ({ modelId, isWideLayout }) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const schema = useAppSelector((state) =>
    ChatSelectors.selectConfigurationSchemaByModelId(state, modelId, modelsMap),
  );

  if (!schema?.properties) {
    return null;
  }

  return <IntroTextView schema={schema} isWideLayout={isWideLayout} />;
};
