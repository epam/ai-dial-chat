/** Every New Year scene; hosts enable or disable them by these ids. */
export enum NewYearScene {
  /** A penguin borrows a page control and folds it into the tree's star. */
  PenguinStar = 'penguin-star',
  /** Two elves gift-wrap the composer until the helper's pull on a loose ribbon winds it around the master instead, who hops away bound in a chest bow. */
  GiftWrapping = 'gift-wrapping',
  /** A pompous snowman sleds on a borrowed starter card to deliver a present, loses his head in a fir on impact, recovers it and returns the card. */
  SnowmanDelivery = 'snowman-delivery',
  /** Two reindeer free a ribbon caught on a word copied from the composer, or on a drawn ice catch, before taking flight. */
  ReindeerTakeoff = 'reindeer-takeoff',
  /** An elf fishes the send button onto the composer rim, stomps it to launch fireworks and rides the last rocket away. */
  ElfFireworks = 'elf-fireworks',
  /** A cat misses a fir bauble, swats the model selector into the fir where it hangs as an ornament, and carries it back to its slot. */
  CatBauble = 'cat-bauble',
}

/** What the bauble cat plays with, chosen once from measured geometry. */
export enum CatBaubleMode {
  /** An inert copy of the composer's model selector, hooked up onto the rim and hung on the fir. */
  Selector = 'selector',
  /** A drawn tangerine on the rim, when no model selector is eligible. */
  Tangerine = 'tangerine',
  /** No eligible composer leaves room for the story; only the static still is shown. */
  Static = 'static',
}

/** Where the snowman stages his delivery, chosen once from measured geometry. */
export enum SnowmanStage {
  /** A drawn snow ledge under the starter row; a borrowed card is pulled down to it. */
  Ledge = 'ledge',
  /** The composer's upper edge; a borrowed card from the row above is ridden along it. */
  Rim = 'rim',
  /** The composer's upper edge with a drawn sled, when no card is eligible. */
  RimSled = 'rim-sled',
  /** A self-contained snowy platform below the page content, with a drawn sled. */
  Platform = 'platform',
  /** No free band fits the story; only the static still is shown. */
  Static = 'static',
}

/** What the fireworks elf presses to launch his rockets, chosen once from measured geometry. */
export enum ElfFireworksMode {
  /** An inert copy of the composer's send button, fished onto the rim with a candy cane. */
  Button = 'button',
  /** A drawn detonator box from the sack, when no send button is eligible. */
  Detonator = 'detonator',
  /** No eligible composer leaves room for the story; only the static still is shown. */
  Static = 'static',
}
