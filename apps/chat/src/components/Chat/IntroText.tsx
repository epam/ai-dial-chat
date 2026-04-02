import { FC } from 'react';

import classNames from 'classnames';

import {
  getFormSchemaPropertyType,
  getSortedFormSchemaProperties,
} from '@/src/utils/app/form-schema';

import { useAppSelector } from '@/src/store/hooks';
import { ChatSelectors, ModelsSelectors } from '@/src/store/selectors';

import { MessageFormSchema } from '@epam/ai-dial-shared';

interface IntroTextViewProps {
  schema: MessageFormSchema;
  isWideLayout: boolean;
}

const IntroTextView = ({ schema, isWideLayout }: IntroTextViewProps) => {
  const sortedProperties = getSortedFormSchemaProperties(schema);
  const buttonProperty = sortedProperties.find(([name]) =>
    getFormSchemaPropertyType(schema, name),
  );

  if (!buttonProperty || !buttonProperty[1]?.description) {
    return null;
  }

  return (
    <div
      className={classNames(
        'text-lg font-semibold md:last:mb-5 lg:mx-auto',
        isWideLayout ? 'mx-4 mt-4' : 'm-4',
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

  if (!schema) {
    return null;
  }

  return <IntroTextView schema={schema} isWideLayout={isWideLayout} />;
};
