# Contributing to Toolkit

Thank you for your interest in contributing to Toolkit! As an open-source project, we welcome code contributions, bug reports, documentation updates, and architectural discussions.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand expected interactions within our community.

## Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Rust Toolchain**: Latest stable toolchain (`rustup update stable`)
- **Windows Build Environment**:
  - MSYS2 / MinGW64 toolchain (or MSVC via Visual Studio C++ Build Tools)
  - Microsoft Edge WebView2 (pre-installed on modern Windows 10/11)

### Local Environment
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/<your-username>/Monitor_Tool.git
   cd Monitor_Tool
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Run the development environment:
   ```bash
   npm run tauri dev
   ```

## Workflow & Guidelines

### Branching Model
- `main`: Production-ready branch. All releases are tagged here.
- `feature/<name>`: New capabilities and features.
- `fix/<name>`: Bug fixes and performance patches.

### Commit Conventions
We enforce the [Conventional Commits](https://www.conventionalcommits.org/) standard. Commits should use clear, imperative English:
- `feat`: A new feature or metric monitor.
- `fix`: A bug fix or boundary condition patch.
- `perf`: A code change that improves performance or binary size.
- `docs`: Documentation updates only.
- `refactor`: Code changes that neither fix bugs nor add features.
- `ci`: CI/CD pipeline and automated workflow updates.

### Pre-PR Checklist
Before opening a Pull Request, verify that your changes pass all local quality checks:
```bash
# Run frontend unit tests and TypeScript / Vite build
npm test
npm run build

# Verify Rust formatting, strict Clippy lints, and unit tests
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Pull Request Process
1. Fill out the provided [Pull Request Template](PULL_REQUEST_TEMPLATE.md).
2. Ensure commit history is clean and rebased onto the latest `main`.
3. A maintainer will review your contribution and provide constructive feedback.
