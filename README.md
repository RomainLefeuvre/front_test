# Vulnerability Fork Lookup System

A static web application for identifying one-day vulnerabilities in forked repositories. This system enables security researchers and developers to search for vulnerabilities by commit ID or repository URL, leveraging data from Software Heritage archive analysis.

## Features

- Search vulnerabilities by commit ID or repository origin URL
- View detailed CVE information in OSV format
- Branch-based grouping for origin queries
- Client-side querying using DuckDB WebAssembly
- Fully static deployment (no backend required)

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for local development)

### Installation

```bash
npm install
```

### Local Development Setup

For local development with MinIO (S3-compatible storage), see the detailed guide:

📖 **[Local Development Setup Guide](docs/LOCAL_SETUP.md)**

Quick setup (automated):

```bash
# 1. Extract CVE data (one-time setup)
npm run extract-cve

# 2. Setup MinIO with data (automated)
npm run setup-minio-dev

# 3. Start development server
npm run dev
```

The `setup-minio-dev` script will:
- Start MinIO if not running
- Create and configure the bucket with public read access
- Upload data files if needed
- Verify everything is accessible

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Run integration tests (requires MinIO)
npm run test:integration

# Check MinIO connectivity
npm run check-minio

# Build for production
npm run build
```

### Testing

The project includes both unit and integration tests:

- **Unit tests**: Test individual components and functions in isolation
- **Integration tests**: Test the full stack with MinIO S3 storage

To run integration tests:

```bash
# 1. Ensure MinIO is running
docker-compose up -d

# 2. Check MinIO is ready
npm run check-minio

# 3. Run integration tests
npm run test:integration
```

See [Integration Test Guide](src/__tests__/integration/README.md) for more details.

## Project Structure

- `src/` - React application source code
- `scripts/` - Build and data processing scripts
- `input_data/` - Raw data files (Parquet and CVE archives)
- `public/cve/` - Extracted CVE JSON files
- `docs/` - Documentation

## Documentation

### Getting Started
- 📖 [Local Development Setup](docs/LOCAL_SETUP.md) - Complete guide for setting up MinIO and local development
- ✅ [Quick Verification Guide](docs/QUICK_VERIFICATION.md) - Verify all optimizations are working

### Performance & Optimization
- ⚡ [Parquet Optimizations](docs/PARQUET_OPTIMIZATIONS.md) - Technical deep-dive into query optimizations
- 📋 [Optimization Summary](docs/OPTIMIZATION_SUMMARY.md) - Quick reference for enabled optimizations
- 🔍 [Query Plan Analysis](docs/QUERY_PLAN_ANALYSIS.md) - Understanding DuckDB execution plans
- 🚀 [CVE Loading Optimization](docs/CVE_LOADING_OPTIMIZATION.md) - Lazy loading strategy for filtered results

### Reference
- 🔧 [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions
- 🎨 [Styling Guide](docs/STYLING.md) - UI/UX design guidelines
- 📊 [CVSS Interpretation](docs/CVSS_INTERPRETATION.md) - Understanding vulnerability severity scores

## Technology Stack

- React + TypeScript
- Vite (build tool)
- DuckDB-WASM (client-side querying with Parquet optimizations)
- Tailwind CSS (styling)
- MinIO (local S3-compatible storage)

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
