import { FC, memo, useEffect, useId, useRef } from 'react';

interface EventLogProps {
  entries: readonly string[];
}

const EventLog: FC<EventLogProps> = ({ entries }) => {
  const headingId = useId();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [entries]);

  return (
    <section className="sandbox-event-log" aria-labelledby={headingId}>
      <h2 id={headingId}>Event log</h2>
      <div
        ref={scrollRef}
        className="sandbox-event-log__scroll"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
      >
        {entries.length > 0 ? (
          <ul className="sandbox-event-log__list">
            {entries.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="sandbox-event-log__empty">No events yet</p>
        )}
      </div>
    </section>
  );
};

export default memo(EventLog);
