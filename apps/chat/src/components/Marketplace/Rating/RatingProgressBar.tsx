interface Props {
  total: number;
  count: number;
}

export const RatingProgressBar = ({ total, count }: Props) => {
  return (
    <div className="h-1.5 w-full rounded bg-layer-4">
      <div
        className="h-1.5 w-full rounded bg-accent-secondary"
        style={{ width: `${(count / total) * 100}%` }}
      ></div>
    </div>
  );
};
