# Contributing to DoVi Remuxer

Thank you for your interest in improving DoVi Remuxer! Contributions from the community help make this tool better for everyone.

## Getting Started

1. Ensure you have **Node.js 18+** and **npm** installed.
2. Ensure you have **FFmpeg 5.0+** installed on your system.
3. Fork and clone this repository:
   ```bash
   git clone https://github.com/your-username/dovi-remuxer.git
   cd dovi-remuxer
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start development mode:
   ```bash
   npm run dev
   ```

## Development Workflow

- `electron/`: Contains the Electron main process, IPC handlers, and multiplexing engine (`probe.ts`, `remuxer.ts`, `binaries.ts`).
- `src/`: Contains the React UI and components.
- Run `npm run build:electron` to compile and verify TypeScript types and Vite bundles.

## Submitting Pull Requests

1. Create a descriptive branch: `git checkout -b fix/profile-8-tagging`
2. Follow existing code formatting and naming conventions.
3. Test your changes on sample MKV media files.
4. Submit a Pull Request describing what changes were made and why.
