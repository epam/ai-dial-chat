interface Props {
  topic: string;
}

export const ApplicationTopic = ({ topic }: Props) => {
  return (
    <span
      className="flex items-center rounded border-[1px] border-accent-primary px-1.5 py-1 text-xs leading-3"
      style={{
        backgroundColor: `var(--bg-topic-${topic.toLowerCase()}, var(--bg-accent-primary-alpha))`,
        borderColor: `var(--stroke-topic-${topic.toLowerCase()}, var(--stroke-accent-primary))`,
      }}
    >
      {topic}
    </span>
  );
};
