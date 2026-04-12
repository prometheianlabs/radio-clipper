# Slice 04 — Producer Console

## Goal

Deliver a usable Angular live desk for producers.

## Deliverables

- authenticated live desk
- station selector
- live monitor player
- rolling transcript panel
- transcript selection model
- clip request form
- recent clip job status

## Design rules

- selection must be based on transcript item IDs, not DOM text offsets
- partial items are visible but not selectable
- session identity and stream state stay visible at all times

## Stop condition

A producer can sign in, monitor a live station, select finalized transcript text, and submit a clip request from one screen.
