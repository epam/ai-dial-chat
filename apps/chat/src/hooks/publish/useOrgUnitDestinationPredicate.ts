import { SaveDestinationRoot } from '@epam/ai-dial-chat-hooks';
import { useCallback, useEffect } from 'react';
import { useOrgUnitsContext } from '../../context/OrgUnitsContext';

/** Predicates the publish and save panels use to mark org-unit destinations. */
interface OrgUnitDestinationPredicates {
  /** Whether a folder of the public bucket (the publish tree's only root) is an org unit. */
  isOrgUnitDestination: (folderPath: string[]) => boolean;
  /** Whether a folder in a multi-root save tree is an org unit; only the Organization root holds units. */
  isOrgUnitDestinationInRoot: (
    folderPath: string[],
    rootKey: string,
  ) => boolean;
}

/**
 * Tells the publish destination trees which folders are DIAL Core org units,
 * and starts the shared org-unit read once a panel is open.
 */
export const useOrgUnitDestinationPredicate = (
  isOpen: boolean,
): OrgUnitDestinationPredicates => {
  const { ensureUnits, isOrgUnitFolder } = useOrgUnitsContext();

  useEffect(() => {
    if (isOpen) ensureUnits();
  }, [isOpen, ensureUnits]);

  const isOrgUnitDestination = useCallback(
    (folderPath: string[]): boolean =>
      folderPath.length > 0 && isOrgUnitFolder(folderPath.join('/')),
    [isOrgUnitFolder],
  );

  const isOrgUnitDestinationInRoot = useCallback(
    (folderPath: string[], rootKey: string): boolean =>
      rootKey === SaveDestinationRoot.Organization &&
      isOrgUnitDestination(folderPath),
    [isOrgUnitDestination],
  );

  return { isOrgUnitDestination, isOrgUnitDestinationInRoot };
};
