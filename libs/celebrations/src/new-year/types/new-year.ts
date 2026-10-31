/** Every New Year scene; hosts enable or disable them by these ids. */
export enum NewYearScene {
  /** A penguin borrows a page control and folds it into the tree's star. */
  PenguinStar = 'penguin-star',
  /** Two elves gift-wrap the composer until the helper's pull on a loose ribbon winds it around the master instead, who hops away bound in a chest bow. */
  GiftWrapping = 'gift-wrapping',
  /** A pompous snowman sleds on a borrowed starter card to deliver a present, loses his head in a fir on impact, recovers it and returns the card. */
  SnowmanDelivery = 'snowman-delivery',
  /** Two reindeer free a ribbon caught on a page button before taking flight. */
  ReindeerTakeoff = 'reindeer-takeoff',
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
