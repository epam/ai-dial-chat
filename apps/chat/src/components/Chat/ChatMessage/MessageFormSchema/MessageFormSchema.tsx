import { ChatActions } from '@/src/store/chat/chat.reducer';
import { useAppDispatch } from '@/src/store/hooks';

import { DialMessageFormSchema } from '@epam/ai-dial-shared';

interface MessageFormSchemaProps {
  schema: DialMessageFormSchema;
  isLastMessage: boolean;
}

export const MessageFormSchema = ({ schema }: MessageFormSchemaProps) => {
  const dispatch = useAppDispatch();

  return (
    <div>
      {Object.entries(schema.properties).map(([key, property]) => (
        <div key={key} className="flex flex-col gap-2">
          <p className="mt-2 border-t border-tertiary py-2 text-sm text-primary">
            {property?.description}
          </p>
          <div className="flex items-center gap-2">
            {property?.oneOf?.map((item) => (
              <button
                onClick={() => {
                  dispatch(ChatActions.setInputContent(item.title));
                }}
                key={item.const}
                className="button button-secondary"
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
