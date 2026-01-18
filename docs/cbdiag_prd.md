# cbdiag Product Requirements Document

## Overview

cbdiag is a web-based diagramming tool focused specifically on block diagrams. It emphasizes hierarchical composition through proxy blocks that link to other diagrams, enabling recursive diagram structures.

## Core Concepts

### Blocks
The fundamental unit of a diagram. Blocks can:
- Contain other blocks (nesting)
- Have connections to other blocks
- Be styled (size, color, labels, etc.)

### Connections
Lines or arrows between blocks representing relationships or flow. Connections can exist between:
- Sibling blocks
- Blocks at different nesting levels
- Blocks and their parent container. These will be embedded in parent container and no explicit arrows.

### Proxy Blocks
A special block type that acts as a link/reference to another block diagram. When a user interacts with a proxy block, they can:
- View a preview of the linked diagram
- Navigate into the linked diagram
- See connections that span across diagram boundaries

This enables recursive composition - a complex system can be represented as a simple block at one level, with full detail accessible by drilling down.

## User Requirements

### Diagram Creation
- Create new blank diagrams
- Add, remove, and reposition blocks
- Nest blocks within other blocks
- Create connections between blocks
- Create proxy blocks that reference other diagrams

### Diagram Navigation
- Pan and zoom within a diagram
- Drill down into proxy blocks to view linked diagrams
- Navigate back up the hierarchy
- Breadcrumb or similar indication of current location in hierarchy

### Persistence
- Save diagrams
- Load existing diagrams
- Each diagram has a unique identifier for proxy block references
- File format should be json or proto so it is easy to recreate
- Location of storage is still TBD - recommend some options.
- Edits would ideally be done locally with some sort of persistent storage, with asynchronous synchronization to some cloud storage
- The application should use a ServiceWorker so this can be used in offline mode

### Authentication and users
- Should be able to use standard Google or other common SSO sign in
- No local account support for now
- There are three permissions: Viewers, Editors and Managers
- Viewers are only able to view the diagrams
- Editors are able to modify diagrams as well as view diagrams
- Managers are able to add additional collaborators or remove managers
- To make things simple, all Editors have View permissions. All Managers have Editor and View permissions
- The initial creator of a diagram has manager, editor, and view permissions.
- When a manager invites someone they can choose what permission that person has. They can also change permissions in the future and can remove people if needed.
- Managers can not remove other managers

### Multi-user collaboration
- For now, let's keep it simple and only allow one active editor at a time
- If the current editor is idle for 5 minutes, they will be no longer editor and another person can take that on.

### Export 
- Diagrams should be exported to PNG, SVG, and PDF
- I really want to make them turn into block diagrams in Google Slides, not sure if that is PNG

