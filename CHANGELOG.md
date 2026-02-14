# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial implementation of merge queue system
- Core modules: GitHubAPI, QueueStateManager, PRValidator, BranchUpdater, PRMerger
- Three GitHub Actions: add-to-queue, process-queue, remove-from-queue
- Git-based state management with automatic state file creation
- Automatic branch updates when PRs fall behind master
- Comprehensive error handling and retry logic
- Structured logging throughout
- TypeScript strict mode with full type safety
- Unit tests for core modules
- Comprehensive documentation:
  - README.md with usage instructions
  - ARCHITECTURE.md with technical details
  - SETUP_GUIDE.md with step-by-step setup
  - CONTRIBUTING.md with development guidelines
  - CLAUDE.md with project-specific instructions
- Example workflow files for target repositories
- CI/CD with GitHub Actions
- ESLint configuration
- Jest testing setup

### Features
- **Sequential Processing**: Process one PR at a time to ensure each is tested against latest master
- **Auto-Update Branches**: Automatically merge master into PR branches when they fall behind
- **Multi-Repository Support**: Each repository gets its own independent queue
- **Zero Configuration**: State files auto-created, no manual setup needed
- **Smart Validation**: Validates approvals, required checks, and merge conflicts
- **Flexible Configuration**: Configurable via workflow inputs (merge method, approval requirements, etc.)
- **Priority Queue**: Support for priority-based queue ordering
- **Comprehensive Error Handling**: Graceful handling of failures, conflicts, and timeouts
- **Audit Trail**: PR comments and queue history provide full audit trail

### Security
- Secure token handling with GitHub secrets
- Minimal required permissions
- Input validation and sanitization
- State validation on read/write

## [0.1.0] - 2024-01-15

### Added
- Initial project structure
- Basic TypeScript configuration
- Package dependencies
- Project documentation skeleton

---

## Version History

### Versioning Scheme

- **Major** (X.0.0): Breaking changes to action interfaces or state schema
- **Minor** (0.X.0): New features, backwards compatible
- **Patch** (0.0.X): Bug fixes, documentation updates

### Upgrade Guide

When upgrading between versions:

1. Check CHANGELOG for breaking changes
2. Update action references in target repositories:
   ```yaml
   uses: your-org/merge-queue@vX.Y.Z/src/actions/add-to-queue
   ```
3. Review and update workflow configurations if needed
4. Test with a non-critical PR first

### Support Policy

- **Current major version**: Full support (bug fixes, features, security updates)
- **Previous major version**: Security updates only (6 months after new major release)
- **Older versions**: No support (upgrade recommended)

---

[Unreleased]: https://github.com/your-org/merge-queue/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/merge-queue/releases/tag/v0.1.0
