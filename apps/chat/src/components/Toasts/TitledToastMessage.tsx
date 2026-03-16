interface TitledToastMessageProps {
  title: string;
  message: string;
}

export const TitledToastMessage = ({
  title,
  message,
}: TitledToastMessageProps) => {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="font-semibold">{title}</div>
      <div>{message}</div>
    </div>
  );
};
