import {
  type ComponentType,
  createContext,
  type FC,
  type ReactNode,
  useContext,
} from 'react';
import type { AttachmentCardProps } from '../models/attachment-card';

const AttachmentCardComponentContext = createContext<
  ComponentType<AttachmentCardProps> | undefined
>(undefined);

/** Props accepted by the `AttachmentCardProvider` component. */
export interface AttachmentCardProviderProps {
  /** Component rendered in place of the built-in tile by every `AttachmentCard` below the provider. Receives the same props as `AttachmentCard`. When omitted, the built-in tile is used, including below a provider that set one. */
  component?: ComponentType<AttachmentCardProps>;
  /** Subtree whose attachment cards use `component`. */
  children?: ReactNode;
}

/** Replaces the card every `AttachmentCard` below it renders, so a host can restyle attachments in the tray, message groups and sibling libs without those libs knowing. */
export const AttachmentCardProvider: FC<AttachmentCardProviderProps> = ({
  component,
  children,
}) => (
  <AttachmentCardComponentContext.Provider value={component}>
    {children}
  </AttachmentCardComponentContext.Provider>
);

/** Returns the host's card component from the nearest `AttachmentCardProvider`, or `undefined` for the built-in tile. */
export const useAttachmentCardComponent = ():
  ComponentType<AttachmentCardProps> | undefined =>
  useContext(AttachmentCardComponentContext);
