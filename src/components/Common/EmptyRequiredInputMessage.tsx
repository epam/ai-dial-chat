interface Props {
  text?: string;
}

const EmptyRequiredInputMessage = ({
  text = 'Please fill in all required fields',
}: Props) => {
  return <div className="text-xxs text-red-800 dark:text-red-400">{text}</div>;
};
export default EmptyRequiredInputMessage;
