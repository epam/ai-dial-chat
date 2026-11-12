import type { CSSProperties } from 'react';
import type {
  PublishDependency,
  PublishDependencyType,
} from './publish-dependency';

/** Text overrides for the private-dependencies section. */
export interface PublishDependenciesLabels {
  /** Section heading. Default: `'Private dependencies'`. */
  title?: string;
  /** Warning shown under the heading: why a private dependency matters; the host names the published entity in it. Default: a generic text about "this item". */
  description?: string;
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
  /** Typography class for each dependency name. Default: `'dial-small-semi-text'`. */
  nameClassName?: string;
  /** Typography class for each dependency's type, version and location. Default: `'dial-small-text'`. */
  metaClassName?: string;
  /** Style overrides. */
  styles?: PublishDependenciesStyles;
}
