/** Number of option rows the searchable Create menu shows before it scrolls. */
export const CREATE_MENU_VISIBLE_ROWS = 7;

/*
 * Mirrors the kit's menu geometry: 40px rows 2px apart inside the panel's and
 * the list's 4px insets, below a 44px search row (a small `Search` in
 * `pt-2 pb-1`). Keep in step with the kit's overlay row height.
 */
const MENU_ROW_HEIGHT_PX = 40;
const MENU_ROW_GAP_PX = 2;
// The panel's 4px inset plus the list's 4px inset.
const MENU_INSETS_PX = 8;
const MENU_SEARCH_ROW_PX = 44;

/** Maximum height of the searchable Create menu: the search row plus `CREATE_MENU_VISIBLE_ROWS` option rows. */
export const CREATE_MENU_MAX_HEIGHT_PX =
  MENU_SEARCH_ROW_PX +
  MENU_INSETS_PX +
  CREATE_MENU_VISIBLE_ROWS * MENU_ROW_HEIGHT_PX +
  (CREATE_MENU_VISIBLE_ROWS - 1) * MENU_ROW_GAP_PX;

/** Fixed width of the searchable Create menu panel, so filtering never resizes it. */
export const CREATE_MENU_LIST_CLASS_NAME = 'w-[320px]';
