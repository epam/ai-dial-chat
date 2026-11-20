import type { CSSProperties } from 'react';
import type {
  PublishDependency,
  PublishDependencyType,
} from './publish-dependency';

/**
 * How the dependencies section is presented. The host picks it: a host that
 * only warns about the dependencies keeps the default `Warning`, a host that
 * publishes them together with the item says so with `Published`, which swaps
 * the warning banner for a plain caption and lays the rows out as an icon next
 * to the type label over the name.
 */
export enum PublishDependenciesAppearance {
  Warning = 'warning',
  Published = 'published',
}

/** Text overrides for the private-dependencies section. */
export interface PublishDependenciesLabels {
  /** Section heading. Default: `'Private dependencies'`. */
  title?: string;
  /** Text under the heading: why a private dependency matters, or that the dependencies are published with the item; the host names the published entity in it. Default: a generic warning about "this item". */
  description?: string;
  /** How the section is presented. Default: `PublishDependenciesAppearance.Warning`. */
  appearance?: PublishDependenciesAppearance;
  /** Label per kind of dependency. Defaults: `'Application'`, `'Toolset'`, `'Prompt'`, `'Skill'`, `'File'`. */
  typeLabels?: Partial<Record<PublishDependencyType, string>>;
  /** Text announced to screen readers when the section appears or its count changes; receives the count. */
  getAnnouncement?: (count: number) => string;
}

/** Color overrides for the private-dependencies section. */
export interface PublishDependenciesColors {
  /** Heading text color. Defaults to `--text-primary`. */
  headingText?: string;
  /** Dependency name text color. Defaults to `--text-primary`. */
  nameText?: string;
  /** Type, version and location text color. Defaults to `--text-secondary`. */
  metaText?: string;
  /** Caption text color under the heading, in the `Published` appearance. Defaults to `--text-secondary`. */
  captionText?: string;
  /** Type label color above each name, in the `Published` appearance. Defaults to `--text-accent-tertiary`. */
  typeText?: string;
  /** Divider color between rows, in the `Published` appearance. Defaults to `--stroke-tertiary`. */
  divider?: string;
}

/** Style overrides for the private-dependencies section. */
export interface PublishDependenciesStyles {
  /** Color overrides for the section. */
  colors?: PublishDependenciesColors;
  /** Additional CSS custom properties applied to the section root. */
  cssVars?: CSSProperties;
}

/** Props for `PublishDependenciesList`. */
export interface PublishDependenciesListProps {
  /** Dependencies to list. The list is hidden while this is empty. */
  dependencies: PublishDependency[];
  /** Text overrides. */
  labels?: PublishDependenciesLabels;
  /** Typography class for the heading. Default: `'dial-body-semi-text'`. */
  headingClassName?: string;
  /** Typography class for each dependency name. Default: `'dial-small-semi-text'`, or `'dial-body-semi-text'` in the `Published` appearance. */
  nameClassName?: string;
  /** Typography class for each dependency's type, version and location. Default: `'dial-small-text'`. */
  metaClassName?: string;
  /** Typography class for the caption under the heading, in the `Published` appearance. Default: `'dial-tiny-text'`. */
  captionClassName?: string;
  /** Typography class for the type label above each name, in the `Published` appearance. Default: `'dial-tiny-lead-semi-text'`, which also upper-cases it. */
  typeClassName?: string;
  /** Style overrides. */
  styles?: PublishDependenciesStyles;
}
