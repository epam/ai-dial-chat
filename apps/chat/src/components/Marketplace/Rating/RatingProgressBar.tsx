interface Props {
  total: number;
  count: number;
}

export const RatingProgressBar = ({ total, count }: Props) => {
  return (
    <div className="relative h-1.5 w-full rounded bg-layer-4">
      <span
        className="relative h-1.5 w-full rounded bg-accent-secondary"
        style={{ width: `${(count / total) * 100}%` }}
      ></span>
    </div>
  );
};
