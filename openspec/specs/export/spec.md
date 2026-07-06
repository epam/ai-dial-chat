## Purpose

Defines the naming conventions for files produced by chat export actions (conversations, prompts, and table CSV downloads), ensuring consistent, sortable filenames across all export types.

## Requirements

### Requirement: Export filenames SHALL use a zero-padded ISO date prefix

All files exported from the chat UI SHALL begin with a date segment in `YYYY-MM-DD` format, with month and day zero-padded to two digits.

#### Scenario: Conversation export filename uses zero-padded date
- **WHEN** the user exports a single conversation on a date such as 3 July 2026
- **THEN** the exported filename SHALL begin with `2026-07-03_` (not `2026-7-3_`)

#### Scenario: Conversations history export filename uses zero-padded date
- **WHEN** the user exports all conversations
- **THEN** the exported filename SHALL begin with `YYYY-MM-DD_` with zero-padded month and day

#### Scenario: Prompt export filename uses zero-padded date
- **WHEN** the user exports a single prompt
- **THEN** the exported filename SHALL begin with `YYYY-MM-DD_` with zero-padded month and day

#### Scenario: Prompts history export filename uses zero-padded date
- **WHEN** the user exports all prompts
- **THEN** the exported filename SHALL begin with `YYYY-MM-DD_` with zero-padded month and day

### Requirement: Export filenames SHALL follow a date-first naming pattern

The date prefix SHALL appear at the start of the filename so that exports sort chronologically by name in file browsers. Entity names and type suffixes follow the date.

#### Scenario: Conversation export filename structure
- **WHEN** the user exports a conversation named "My chat"
- **THEN** the filename SHALL follow the pattern `YYYY-MM-DD_my_chat_chat_conversation.json`

#### Scenario: Table CSV download filename structure
- **WHEN** the user downloads a markdown table as CSV
- **THEN** the default filename SHALL follow the pattern `YYYY-MM-DD_table.csv`
- **THEN** the user MAY edit this filename before confirming the download
