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

### Nesting and blocks
- Blocks can support parenting/nesting. This is also recursive.
- For the following examples, assume Block B and Block C have Block A as a parent. Block D has Block C as a parent.
- If Block A is translated, Block B, Block C, and transitively Block D translate the same way.
- If Block A is scaled or resized, Block B and Block C retain their relative positions within block A rather than change relative positions with Block A. Block D also retains relative size within Block C, which transitively has same position in Block A.
- Block A is constrained from scaling or resizing to be too small -> e.g. it can not be scaled to a point where it can no longer contain the blocks within it. A user has to manually tune Block B, Block C, and Block D locations or sizes so they fit within Block A.
- There should also always be enough of a size gap/pad so sub-blocks do not fill the entire area of the parent block. This will allow selecting the parent block.
- Child Blocks automatically have a z-level the same as the parent block.
- To establish a parenting relationship, as a user I would ideally be able to drag and hold a block over the to-be-parent and have it inherit, with some amount of animation like pulsing on the parent to indicate that the parenting will happen. For example, if I drag Block E over free space in Block A and leave it there, it will show an animation and then parent when the mouse releases. Also, if I do this over Block D it would show the D parenting relationship. It should always select the block lowest in the tree parenting level as the parent. 
- If during parenting operation the parent block is not large enough to contain the new child block and maintain padding/gap, the parent block will get larger to accomodate it.
- Unparenting will happen by dragging a child block out of a parent block. Similar to creating a parenting relationship, there will be an animation indicating that the unparenting will happen, and it will happen on mouse unclick.
 
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

