import { memo, type FC } from 'react';

interface Props {
  title: string;
  emptyMessage: string;
}

// TODO: support links when assistant message references will be available
const SourcesSection: FC<Props> = ({ title, emptyMessage }) => (
  <section className="mb-6">
    <h2 className="dial-body-semi-text mb-3">{title}</h2>
    <p className="dial-small-text text-secondary">{emptyMessage}</p>
  </section>
);

export default memo(SourcesSection);
