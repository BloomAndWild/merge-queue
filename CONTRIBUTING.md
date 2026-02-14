# Contributing to Merge Queue

Thank you for your interest in contributing to the Merge Queue project! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js 20.x or higher
- npm
- Git
- A GitHub account

### Getting Started

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/merge-queue.git
   cd merge-queue
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

5. Run linter:
   ```bash
   npm run lint
   ```

## Project Structure

```
/src/
  /core/           # Core business logic
  /actions/        # GitHub Action implementations
  /utils/          # Utility functions
  /types/          # TypeScript type definitions
/docs/             # Documentation
/examples/         # Example configurations
/scripts/          # Build and utility scripts
```

## Development Workflow

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes, following our coding standards

3. Write or update tests for your changes

4. Ensure all tests pass:
   ```bash
   npm test
   ```

5. Ensure code passes linting:
   ```bash
   npm run lint
   ```

6. Commit your changes:
   ```bash
   git commit -m "feat: description of your changes"
   ```

### Commit Message Convention

We use conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions or changes
- `refactor:` Code refactoring
- `chore:` Build process or auxiliary tool changes

### Pull Request Process

1. Push your branch to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Create a Pull Request on GitHub

3. Ensure the PR description clearly describes the problem and solution

4. Link any relevant issues

5. Wait for review and address feedback

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use async/await over promises
- Follow existing naming conventions:
  - Classes: PascalCase
  - Functions/variables: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Interfaces: PascalCase

### Code Organization

- Keep functions small and focused
- Use meaningful variable and function names
- Add comments for complex logic
- Extract reusable code into utility functions

### Error Handling

- Use custom error classes from `src/utils/errors.ts`
- Always catch and handle errors appropriately
- Log errors with context using the Logger
- Provide meaningful error messages

### Testing

- Write unit tests for all new functionality
- Aim for >80% code coverage
- Test edge cases and error conditions
- Use descriptive test names:
  ```typescript
  it('should reject PRs with blocking labels', async () => {
    // test implementation
  });
  ```

### Documentation

- Add JSDoc comments to public functions and classes
- Update README.md for user-facing changes
- Update ARCHITECTURE.md for architectural changes
- Include inline comments for complex logic

## Building Actions

When modifying GitHub Actions, remember to rebuild them:

```bash
npm run build:actions
```

This compiles TypeScript and bundles actions with dependencies using `@vercel/ncc`.

## Testing Actions

### Local Testing

You can test actions locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act

# Test an action
act -j add-to-queue
```

### Integration Testing

1. Push changes to a test repository
2. Reference your branch in workflow files:
   ```yaml
   uses: your-org/merge-queue@your-branch/src/actions/add-to-queue
   ```
3. Test with real PRs

## Adding New Features

### Before Starting

1. Check existing issues to avoid duplication
2. Open an issue to discuss significant changes
3. Get feedback on your approach before investing time

### Feature Checklist

- [ ] Code implements the feature
- [ ] Unit tests added/updated
- [ ] Integration tests added (if applicable)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No breaking changes (or clearly documented)

## Reporting Bugs

### Before Reporting

1. Check existing issues for duplicates
2. Test with the latest version
3. Gather relevant information:
   - Version of merge-queue
   - Node.js version
   - Error messages and logs
   - Steps to reproduce

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Step one
2. Step two
3. ...

**Expected Behavior**
What you expected to happen

**Actual Behavior**
What actually happened

**Environment**
- Merge Queue Version: X.Y.Z
- Node.js Version: X.Y.Z
- GitHub Actions runner: ubuntu-latest

**Logs**
```
Relevant log output
```
```

## Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead, email security concerns to: [your-security-email]

## Code Review Process

### What We Look For

- Code quality and style
- Test coverage
- Documentation
- Performance implications
- Security considerations
- Breaking changes

### Timeline

- Initial review: Within 3-5 business days
- Follow-up reviews: Within 1-2 business days
- Merge: After approval from maintainer(s)

## Release Process

For maintainers:

1. Update version in package.json
2. Update CHANGELOG.md
3. Create git tag:
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```
4. GitHub Actions will create a release

## Getting Help

- **Documentation**: Check docs/ directory
- **Issues**: Search or create GitHub issues
- **Discussions**: Use GitHub Discussions for questions
- **CLAUDE.md**: See development guidelines

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- CHANGELOG.md for their contributions
- GitHub contributors page
- Release notes

Thank you for contributing! 🎉
