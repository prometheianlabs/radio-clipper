# UI Screens

## State strategy

Use Angular signals or NgRx Signal Store.  
Do not let transcript selection and clip job state live only inside components.

Recommended state slices:

- `authStore`
- `stationStore`
- `transcriptStore`
- `selectionStore`
- `clipStore`
- `adminStore`

## 1. Live Desk

This is the primary v1 screen.

### Purpose

Give the producer one place to:

- monitor live audio
- read transcript and captions
- highlight finalized text
- create a clip fast

### Layout

Left column:
- station selector
- stream status
- transcript delay badge
- live monitor player
- session metadata

Center column:
- rolling transcript panel
- partial text visually distinct from final text
- transcript search
- selection interaction

Right column:
- selected text preview
- derived start/end timestamps
- clip title input
- pre-roll and post-roll padding fields
- create clip button
- recent clip jobs

## Transcript selection model

Transcript items are rendered as selectable units.

Selection rules:

- click to set start anchor
- shift-click or drag to extend
- only finalized items are selectable
- selection is stored by item IDs and derived times
- new transcript items must not break an existing selection

## 2. Clip Library

Features:

- filter by station, date, status, user
- replay clips
- download clips
- show source session and timestamps

## 3. Admin Station Health

Features:

- station online/offline
- last heartbeat
- current session
- ingest protocol in use
- reconnect count
- transcript lag
- recent export failures
- credential status
- adapter health

## 4. Login and access shell

Use Amplify Auth + Cognito.

Access boundaries:

- `producer`
- `admin`
- `platform_admin`

## UX rules

### Rule 1

Partial transcript text must look different from final transcript text.

### Rule 2

Clip creation must stay on the main live desk for the common case.

### Rule 3

Operational status language must be direct and unambiguous.

### Rule 4

Station identity and live session state must always remain visible.

### Rule 5

Auto-scroll should pause when the user scrolls up to inspect older transcript text.
