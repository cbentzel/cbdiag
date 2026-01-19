# cbdiag

A web-based block diagramming tool focused on hierarchical composition through proxy blocks and recursive diagram structures.

## Overview

cbdiag enables creating complex system diagrams through a unique approach of nested blocks and proxy blocks. Proxy blocks act as references to other diagrams, allowing you to represent complex systems as simple blocks at one level while maintaining full detail accessible by drilling down.

## Features

- **Nested Blocks**: Create blocks within blocks for hierarchical organization
- **Connections**: Define relationships and flows between blocks at any level
- **Proxy Blocks**: Link to other diagrams for recursive composition
- **Diagram Navigation**: Pan, zoom, and drill down through diagram hierarchies
- **Persistence**: Save and load diagrams with JSON-based format
- **Export**: Export diagrams to PNG, SVG, and PDF formats
- **Offline Support**: ServiceWorker-enabled for offline usage
- **Collaboration**: Multi-user support with role-based permissions (Viewers, Editors, Managers)
- **Authentication**: Google and common SSO sign-in support

## Getting Started

### Prerequisites

- Node.js (version 16 or higher recommended)
- npm or yarn

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

### Build

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Testing

Run unit tests:

```bash
npm test
```

Run tests with UI:

```bash
npm run test:ui
```

Run tests with coverage:

```bash
npm run test:coverage
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Run all tests:

```bash
npm run test:all
```

## Documentation

See the [Product Requirements Document](docs/cbdiag_prd.md) for detailed information about features and functionality.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
