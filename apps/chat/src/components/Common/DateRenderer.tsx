import { formatDate } from '@/src/utils/app/common';

interface DateProps {
  dateValue: number | string | Date;
}

export function DateRenderer({ dateValue }: DateProps) {
  return <span>{formatDate(dateValue)}</span>;
}
