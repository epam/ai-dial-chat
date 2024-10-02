import classNames from 'classnames';

interface Props {
  tag: string;
}

enum TagTypes {
  Analysis = 'Analysis',
  SQL = 'SQL',
  Development = 'Development',
}

export const ApplicationTag = ({ tag }: Props) => {
  return (
    <span
      className={classNames(
        'flex items-center rounded border-[1px] border-accent-primary bg-accent-primary-alpha px-1.5 py-1 text-xs leading-3',
        tag === TagTypes.SQL && 'border-accent-primary bg-accent-primary-alpha',
        tag === TagTypes.Analysis &&
          'border-accent-tertiary bg-accent-tertiary-alpha',
        tag === TagTypes.Development &&
          'border-accent-secondary bg-accent-secondary-alpha',
      )}
    >
      {tag}
    </span>
  );
};
