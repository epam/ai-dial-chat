interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  dataQa?: string;
  valueClassName?: string;
  labelClassName?: string;
  wrapperClassName?: string;
}

export function MarketplaceEntityInfoRow({
  label,
  value,
  dataQa,
  valueClassName = 'text-primary',
  labelClassName = 'text-secondary shrink-0 self-start',
  wrapperClassName = 'contents',
}: InfoRowProps) {
  if (value == null || value === '') return null;

  return (
    <div className={wrapperClassName}>
      <span className={labelClassName}>{`${label}:`}</span>
      <div className={valueClassName} data-qa={dataQa}>
        {value}
      </div>
    </div>
  );
}
