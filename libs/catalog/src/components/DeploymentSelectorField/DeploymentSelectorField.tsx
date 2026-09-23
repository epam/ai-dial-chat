import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Dropdown,
  GhostButton,
  Highlight,
  Input,
  MenuItem,
  Search,
} from '@epam/ai-dial-ui-kit';
import {
  type AriaAttributes,
  type FC,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from 'react';

/** Host-resolved picker record. No generated DTO or application URL leaks into this contract. */
export interface DeploymentSelectorDisplayRecord {
  id: string;
  label: string;
  icon?: ReactNode;
  description?: string;
}

export interface DeploymentSelectorExtraOption {
  id: string;
  label: string;
}

export interface DeploymentSelectorFieldLabels {
  searchPlaceholder: string;
  searchAriaLabel: string;
  emptyLabel: string;
  errorLabel: string;
  browseLabel?: string;
}

export interface DeploymentSelectorFieldProps {
  selectedId: string | null;
  records: DeploymentSelectorDisplayRecord[];
  selectedLabel?: string | null;
  placeholder: string;
  labels: DeploymentSelectorFieldLabels;
  onSelect: (id: string) => void;
  onBrowse?: () => void;
  extraOptions?: DeploymentSelectorExtraOption[];
  isLoading?: boolean;
  error?: Error | null;
  isDisabled?: boolean;
  isInvalid?: boolean;
  labelledById?: string;
  /** Accessible popup role. Use `dialog` for a host-rendered sheet. Defaults to `listbox`. */
  ariaHasPopup?: AriaAttributes['aria-haspopup'];
  className?: string;
  panelClassName?: string;
  /** Optional host-resolved trailing affordance, such as a loading spinner. */
  iconAfter?: ReactNode;
  /** Optional host panel for integrations that retain richer host-only actions. */
  renderPanel?: (onClose: () => void) => ReactNode;
  /** Controlled open state. Omit with `onOpenChange` to use local state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Composes the popup or mobile sheet around the reusable panel. */
  renderOverlay?: (
    panel: ReactNode,
    isOpen: boolean,
    onClose: () => void,
  ) => ReactNode;
}

/** Controlled, provider-free model/agent field and searchable panel. */
export const DeploymentSelectorField: FC<DeploymentSelectorFieldProps> = ({
  selectedId,
  records,
  selectedLabel,
  placeholder,
  labels,
  onSelect,
  onBrowse,
  extraOptions = [],
  isLoading = false,
  error,
  isDisabled = false,
  isInvalid = false,
  labelledById,
  ariaHasPopup = 'listbox',
  className,
  panelClassName,
  iconAfter,
  renderPanel,
  open,
  onOpenChange,
  renderOverlay,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setIsOpen = (nextOpen: boolean) => {
    if (nextOpen && isDisabled) return;
    if (open === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLInputElement>(null);
  const options = useMemo<DeploymentSelectorDisplayRecord[]>(
    () =>
      [...extraOptions, ...records].filter((option) =>
        option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      ),
    [extraOptions, records, query],
  );
  const close = () => {
    setIsOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const select = (id: string) => {
    onSelect(id);
    close();
  };
  const panel = renderPanel ? (
    renderPanel(close)
  ) : (
    <div
      className={mergeClasses('w-full min-w-0 max-w-full p-3', panelClassName)}
    >
      <Search
        value={query}
        onChange={(value) => setQuery(value ?? '')}
        placeholder={labels.searchPlaceholder}
        aria-label={labels.searchAriaLabel}
      />
      <div
        role="listbox"
        className="mt-2 max-h-[min(50dvh,320px)] min-w-0 overflow-y-auto"
      >
        {isLoading ? (
          <span role="status">{labels.searchPlaceholder}</span>
        ) : error ? (
          <span role="alert">{labels.errorLabel}</span>
        ) : options.length === 0 ? (
          <span role="status">{labels.emptyLabel}</span>
        ) : (
          options.map((option) => (
            <MenuItem
              key={option.id}
              role="option"
              aria-selected={option.id === selectedId}
              selected={option.id === selectedId}
              label={
                <span className="flex min-w-0 items-center gap-2">
                  {option.icon && <span aria-hidden>{option.icon}</span>}
                  <span className="flex min-w-0 flex-col">
                    <Highlight text={option.label} query={query} maxLines={2} />
                    {option.description && <span>{option.description}</span>}
                  </span>
                </span>
              }
              onClick={() => select(option.id)}
              className="h-auto max-w-full py-2"
            />
          ))
        )}
      </div>
      {onBrowse && (
        <GhostButton
          className="mt-2 min-h-11 max-w-full"
          label={labels.browseLabel ?? ''}
          onClick={() => {
            onBrowse();
            close();
          }}
        />
      )}
    </div>
  );
  const trigger = (
    <Input
      onFocus={(event) => {
        triggerRef.current = event.currentTarget;
      }}
      readOnly
      role="combobox"
      aria-haspopup={ariaHasPopup}
      aria-expanded={isOpen}
      aria-labelledby={labelledById}
      disabled={isDisabled}
      invalid={isInvalid || Boolean(error)}
      value={
        selectedLabel ??
        records.find((record) => record.id === selectedId)?.label ??
        selectedId ??
        ''
      }
      placeholder={placeholder}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
          close();
          return;
        }
        if (renderOverlay && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          setIsOpen(!isOpen);
        }
      }}
      containerClassName="w-full min-w-0"
      wrapperClassName={mergeClasses('cursor-pointer', className)}
      className="cursor-pointer"
      iconAfter={iconAfter}
    />
  );
  if (renderOverlay)
    return (
      <>
        {/* The input handles keyboard activation; this wrapper also makes
            the trailing icon and padding pointer targets for custom sheets. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard activation is owned by the combobox input */}
        <div className="w-full min-w-0" onClick={() => setIsOpen(!isOpen)}>
          {trigger}
        </div>
        {renderOverlay(panel, isOpen, close)}
      </>
    );
  return (
    <Dropdown
      open={isOpen}
      onOpenChange={setIsOpen}
      disabled={isDisabled}
      className="w-full"
      listClassName="w-[min(var(--reference-width),calc(100vw-2rem))] max-w-full"
      renderOverlay={() => panel}
    >
      {trigger}
    </Dropdown>
  );
};
