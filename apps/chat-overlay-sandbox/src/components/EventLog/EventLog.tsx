import {
  FC,
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

interface EventLogProps {
  entries: readonly string[];
  onClear: () => void;
}

const EventLog: FC<EventLogProps> = ({ entries, onClear }) => {
  const headingId = useId();
  const panelId = useId();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const handleClose = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(entries.join('\n'));
      setCopyStatus('Event log copied');
    } catch {
      setCopyStatus('Could not copy event log');
    }
  }, [entries]);

  const handleClear = useCallback(() => {
    onClear();
    setCopyStatus('Event log cleared');
  }, [onClear]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [entries]);

  useEffect(() => {
    if (!isOpen) return;

    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        className="sandbox-event-log-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(true)}
      >
        <span>Event log</span>
        <span
          className="sandbox-event-log-trigger__count"
          aria-label={`${entries.length} events`}
        >
          {entries.length}
        </span>
      </button>

      <aside
        id={panelId}
        className={
          isOpen
            ? 'sandbox-event-log sandbox-event-log--open'
            : 'sandbox-event-log'
        }
        aria-labelledby={headingId}
        inert={!isOpen}
      >
        <header className="sandbox-event-log__header">
          <h2 id={headingId}>Event log</h2>
          <button
            ref={closeRef}
            className="sandbox-event-log__close"
            type="button"
            onClick={handleClose}
          >
            Close
          </button>
        </header>

        <div className="sandbox-event-log__actions">
          <button
            type="button"
            disabled={entries.length === 0}
            onClick={handleCopy}
          >
            Copy all
          </button>
          <button
            type="button"
            disabled={entries.length === 0}
            onClick={handleClear}
          >
            Clear
          </button>
        </div>

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

        <span
          className="sandbox-visually-hidden"
          role="status"
          aria-live="polite"
        >
          {copyStatus}
        </span>
      </aside>
    </>
  );
};

export default memo(EventLog);
