/** Media types a celebration asset may declare; anything else makes the asset invalid. */
export enum CelebrationMediaType {
  Json = 'application/json',
  Svg = 'image/svg+xml',
  Png = 'image/png',
  Webp = 'image/webp',
}

/** How a scene adapts to a right-to-left host. */
export enum CelebrationSceneDirection {
  None = 'none',
  Mirror = 'mirror',
  Variant = 'variant',
}

/** How a `viewport-stage-v1` stage scales into the viewport. */
export enum CelebrationStageFit {
  Contain = 'contain',
  Cover = 'cover',
}

/** Where a `viewport-stage-v1` stage sits in the viewport, in logical terms. */
export enum CelebrationStageAlign {
  Center = 'center',
  Top = 'top',
  Bottom = 'bottom',
  TopStart = 'top-start',
  TopEnd = 'top-end',
  BottomStart = 'bottom-start',
  BottomEnd = 'bottom-end',
}

/** Host layout a variant can be restricted to. */
export enum CelebrationVariantLayout {
  Mobile = 'mobile',
  Desktop = 'desktop',
}

/** Text direction a variant can be restricted to. */
export enum CelebrationVariantDirection {
  Ltr = 'ltr',
  Rtl = 'rtl',
}

/** Color scheme a variant can be restricted to. */
export enum CelebrationVariantColorScheme {
  Light = 'light',
  Dark = 'dark',
}

/** Kind of upstream celebration resource, used in rejection logs. */
export enum CelebrationResourceKind {
  Index = 'index',
  Manifest = 'manifest',
  Asset = 'asset',
}

/** `Content-Encoding` values the celebrations endpoints can serve. */
export enum CelebrationContentEncoding {
  Brotli = 'br',
  Gzip = 'gzip',
}
