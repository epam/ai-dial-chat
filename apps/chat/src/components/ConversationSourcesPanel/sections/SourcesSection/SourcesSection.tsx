import type { FC } from 'react';

interface Props {
  title: string;
  emptyMessage: string;
}

// Links are not yet emitted by the backend — section ships header + empty placeholder only.
const SourcesSection: FC<Props> = ({ title, emptyMessage }) => (
  <section className="mb-6">
    <h2 className="mb-3 text-base font-semibold">{title}</h2>
    <p className="text-sm text-secondary">{emptyMessage}</p>
  </section>
);

export default SourcesSection;
