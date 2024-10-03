import { getTopicColors } from '@/src/utils/app/style-helpers';

interface Props {
  topic: string;
}

export const ApplicationTopic = ({ topic }: Props) => {
  return (
    <span
      className="flex items-center whitespace-nowrap rounded border border-accent-primary px-1.5 py-1 text-xs leading-3"
      style={getTopicColors(topic)}
    >
      {topic}
    </span>
  );
};
