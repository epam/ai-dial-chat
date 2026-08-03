import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';
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
  triggerClassName?: string;
}

const EventLog: FC<EventLogProps> = ({
  entries,
  onClear,
  triggerClassName = 'end-5',
}) => {
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
      <DialPrimaryButton
        ref={triggerRef}
        className={`fixed bottom-6 z-[9999] min-h-12 rounded-full shadow-md ${triggerClassName}`}
        type="button"
        aria-label={`Event log ${entries.length} events`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(true)}
        label={<span aria-hidden>Event log</span>}
        iconAfter={
          <span
            className="grid h-7 min-w-7 place-items-center rounded-full bg-layer-raised px-1.5 text-xs font-bold text-primary"
            aria-label={`${entries.length} events`}
          >
            {entries.length}
          </span>
        }
      />

      <aside
        id={panelId}
        className={`fixed inset-x-0 bottom-0 z-[10000] flex max-h-[65dvh] flex-col rounded-t-[18px] border border-secondary bg-layer-raised px-4 py-4 shadow-lg transition-[transform,visibility] duration-200 motion-reduce:transition-none desktop:inset-y-0 desktop:end-0 desktop:start-auto desktop:max-h-none desktop:w-[min(560px,48vw)] desktop:rounded-e-none desktop:rounded-s-2xl desktop:px-5 desktop:py-6 ${
          isOpen
            ? 'visible translate-y-0 desktop:translate-x-0 desktop:rtl:translate-x-0'
            : 'invisible translate-y-full desktop:translate-x-full desktop:translate-y-0 desktop:rtl:-translate-x-full'
        }`}
        aria-labelledby={headingId}
        inert={!isOpen}
      >
        <header className="mb-3 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl" id={headingId}>
            Event log
          </h2>
          <DialNeutralButton
            ref={closeRef}
            className="min-h-11"
            type="button"
            label="Close"
            onClick={handleClose}
          />
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <DialNeutralButton
            className="min-h-11"
            type="button"
            label="Copy all"
            disabled={entries.length === 0}
            onClick={handleCopy}
          />
          <DialNeutralButton
            className="min-h-11"
            type="button"
            label="Clear"
            disabled={entries.length === 0}
            onClick={handleClear}
          />
        </div>

        <div
          ref={scrollRef}
          className="focus-visible:outline-offset-3 min-h-[120px] flex-1 overflow-auto overscroll-contain rounded-lg border border-secondary bg-layer-base px-3 py-2.5 font-mono text-[0.8125rem] leading-6 text-primary focus-visible:outline focus-visible:outline-2"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          tabIndex={0}
        >
          {entries.length > 0 ? (
            <ul className="m-0 list-disc ps-5 [overflow-wrap:anywhere]">
              {entries.map((line, index) => (
                <li className="mt-1.5 first:mt-0" key={`${index}-${line}`}>
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-secondary">No events yet</p>
          )}
        </div>

        <span className="sr-only" role="status" aria-live="polite">
          {copyStatus}
        </span>
      </aside>
    </>
  );
};

export default memo(EventLog);
