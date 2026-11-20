## MODIFIED Requirements

### Requirement: Schema versioning and compatibility

`schemaVersion` SHALL be `MAJOR.MINOR.PATCH` with components of at most six digits and no leading zeros, independent of Chat's release version. The bump rules are:

- **PATCH:** only annotations change (`title`, `description`, `dial:meta`, `isHidden`, `default`, the `dial:semanticConstraints` text), and the set of valid payloads is unchanged.
- **MINOR:** the set of valid payloads grows, and every payload valid under the previous version stays valid.
- **MAJOR:** anything else, including removing a key, narrowing a bound, changing a type or meaning, adding a required member, or adding any feature-policy member.

The artifact test SHALL compare the schema with the previous committed version and fail when:

- a difference outside annotation keywords is not at least a MINOR bump;
- a removed property or a newly required member is not a MAJOR bump;
- a MINOR successor rejects any of the previous version's valid contract fixtures.

A Chat build SHALL declare the exact list of schema versions it accepts. For this change the list is `["1.0.0", "1.1.0"]`, and `1.1.0` is the current version the generator writes. The committed `1.0.0` artifact, its index entry and its pin SHALL stay byte-for-byte and hash-for-hash unchanged.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Annotation-only change

- **WHEN** only a managed key's description changes
- **THEN** a PATCH bump satisfies the test

#### Scenario: Narrowed bound under a minor bump

- **WHEN** `announcement.title` `maxLength` drops from 200 to 100 and the version is bumped from 1.1.0 to 1.2.0
- **THEN** the artifact test fails because previous fixtures no longer validate

#### Scenario: Removed key under a minor bump

- **WHEN** a managed key is removed and the version is bumped only to 1.2.0
- **THEN** the artifact test fails and requires 2.0.0

#### Scenario: 1.1.0 is a minor successor of 1.0.0

- **WHEN** the artifact test compares `ai-dial-chat-1.1.0.json` with `ai-dial-chat-1.0.0.json`
- **THEN** the only differences are added optional properties under `config`, every 1.0.0 valid fixture validates under 1.1.0, and the test passes

#### Scenario: The index lists both versions

- **WHEN** `npm run managed-config-schema` runs on this change
- **THEN** `apps/chat-api/managed-config-schema/index.json` has `current` `1.1.0`, `supported` `["1.0.0", "1.1.0"]`, and one entry per version whose `schemaSha256` equals its pin, with the 1.0.0 entry unchanged

#### Scenario: The 1.0.0 pin is untouched

- **WHEN** the registry gains the 1.1.0 keys and the generator runs
- **THEN** `ai-dial-chat-1.0.0.json` is read back unchanged and its pin is still `edbe9267f6663eb7768ae7e2033e20b0b3c842994224a774968d348e3b9be71f`
