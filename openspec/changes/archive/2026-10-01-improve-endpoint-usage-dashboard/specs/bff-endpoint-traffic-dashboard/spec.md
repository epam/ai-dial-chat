## MODIFIED Requirements

### Requirement: Readable rankings and frequency

The dashboard SHALL include period summary cards, ranked API areas, a horizontal top-ten
endpoint ranking, a request-per-minute trend, and a sortable table containing endpoint,
estimated period requests, average requests/minute, and share of the selected traffic.
The table SHALL contain all matching observed endpoints, without a top-k limit. Numeric values
and labels SHALL supplement color; rendering and accessibility use native Grafana controls.
English labels follow the existing Grafana examples; no app i18n or RTL behavior is introduced.
Request estimates SHALL use full locale-separated whole-number display without rounding the
underlying query values, with the estimate semantics visible. The API-area summary SHALL show
explicit area names, period counts, and shares in table columns. The trend SHALL use a clearly
labeled symmetric logarithmic axis that accommodates zero, ordinary rates, and large spikes.

#### Scenario: Ranking changes during the selected period

- **WHEN** more than ten endpoints exchange rank during the period
- **THEN** the trend uses the fixed top ten by total traffic for the entire selected period
- **AND** the endpoint ranking uses the same period and grouping.

#### Scenario: Low-volume endpoint

- **WHEN** an endpoint falls outside the top ten
- **THEN** it remains in the table when its metric is present
- **AND** selecting that route allows its trend to be inspected.

#### Scenario: Many API areas

- **WHEN** the summary contains twenty API areas
- **THEN** each visible row shows its area name, estimated count, and traffic share
- **AND** names are not hidden by automatic gauge sizing.

#### Scenario: A large rate spike

- **WHEN** the selected period includes a spike far above ordinary traffic
- **THEN** the trend keeps the spike and ordinary nonzero rates visible without clipping values
- **AND** the scale is explicitly labeled and tooltips retain actual rates.
