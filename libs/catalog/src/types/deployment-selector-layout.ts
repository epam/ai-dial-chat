/** How `DeploymentSelectorPanel` arranges the selected, pinned and favourite rows. */
export enum DeploymentSelectorLayout {
  /** A "Currently selected" section above a headed Favorites section. */
  Sectioned = 'sectioned',
  /** One list without headings: pinned row, then the selection when it is not a favourite, then favourites. */
  Flat = 'flat',
}
