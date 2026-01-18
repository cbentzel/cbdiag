# PRD Implementation Status

This document tracks which features from the [PRD](cbdiag_prd.md) have been implemented.

## Legend
- [x] Implemented
- [ ] Not yet implemented
- [~] Partially implemented

---

## Blocks

| Feature | Status | Notes |
|---------|--------|-------|
| Add blocks | [x] | Click "+ Block" button |
| Remove blocks | [x] | Select and press Delete or click Delete button |
| Reposition blocks | [x] | Drag to move |
| Resize blocks | [x] | Drag corner handle when selected |
| Style blocks (color) | [x] | Properties panel |
| Style blocks (labels) | [x] | Properties panel |
| Nest blocks within blocks | [ ] | Not yet implemented |

## Connections

| Feature | Status | Notes |
|---------|--------|-------|
| Create connections between sibling blocks | [x] | Click "+ Connection" then click two blocks |
| Connections at different nesting levels | [ ] | Requires nested blocks first |
| Connections to parent container | [ ] | Requires nested blocks first |

## Proxy Blocks

| Feature | Status | Notes |
|---------|--------|-------|
| Create proxy blocks | [ ] | |
| View preview of linked diagram | [ ] | |
| Navigate into linked diagram | [ ] | |
| Connections spanning diagram boundaries | [ ] | |

## Diagram Navigation

| Feature | Status | Notes |
|---------|--------|-------|
| Pan within diagram | [x] | Click and drag on canvas |
| Zoom within diagram | [x] | Mouse wheel |
| Drill down into proxy blocks | [ ] | Requires proxy blocks |
| Navigate back up hierarchy | [ ] | Requires proxy blocks |
| Breadcrumb navigation | [ ] | |

## Persistence

| Feature | Status | Notes |
|---------|--------|-------|
| Save diagrams | [x] | localStorage only |
| Load diagrams | [x] | localStorage only |
| Unique diagram identifiers | [ ] | |
| JSON file format | [x] | |
| Cloud storage | [ ] | |
| Local persistent storage with sync | [ ] | |
| ServiceWorker for offline mode | [ ] | |

## Authentication and Users

| Feature | Status | Notes |
|---------|--------|-------|
| Google SSO sign in | [ ] | |
| Other SSO providers | [ ] | |
| Viewer permissions | [ ] | |
| Editor permissions | [ ] | |
| Manager permissions | [ ] | |
| Permission management UI | [ ] | |

## Multi-user Collaboration

| Feature | Status | Notes |
|---------|--------|-------|
| Single active editor model | [ ] | |
| 5-minute idle timeout | [ ] | |

## Export

| Feature | Status | Notes |
|---------|--------|-------|
| Export to PNG | [ ] | |
| Export to SVG | [ ] | |
| Export to PDF | [ ] | |
| Export to Google Slides format | [ ] | |

---

## Summary

### Implemented (v0.1)
- Basic block creation, deletion, movement, and resizing
- Block styling (color, labels, dimensions)
- Connections between blocks with arrows
- Pan and zoom navigation
- Save/load to browser localStorage
- Properties panel for editing selected block

### Priority for Next Iteration
1. **Nested blocks** - Core feature for hierarchical diagrams
2. **Multiple diagrams** - Ability to create/manage multiple diagrams
3. **Proxy blocks** - Key differentiating feature
4. **Export to PNG/SVG** - Essential for sharing

### Deferred (Lower Priority)
- Authentication/Users
- Multi-user collaboration
- Cloud storage sync
- ServiceWorker/offline mode
- PDF/Slides export
