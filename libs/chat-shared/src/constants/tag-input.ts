/*
 * The ui kit fills a `Tag` and the `TagInput` field it sits in with the same
 * `bg-layer-raised` token, so a committed tag reads as plain text inside the
 * field instead of a chip. Sinking the chip one layer restores the pill until
 * the kit ships its own fix; pass it as `TagInput`'s `tagClassName`.
 */
export const TAG_INPUT_TAG_CLASS_NAME = 'bg-layer-sunken';
