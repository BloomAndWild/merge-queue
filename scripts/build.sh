#!/bin/bash
set -e

echo "Building merge-queue..."

# Clean previous build
echo "Cleaning previous build..."
rm -rf dist

# Build main library
echo "Building TypeScript..."
npm run typecheck
npx tsc

# Build will be completed when actions are created
echo "Build complete!"
