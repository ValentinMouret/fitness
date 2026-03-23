#!/bin/bash
# Setup script for Claude Code cloud sandbox sessions.
# Runs via SessionStart hook but only executes in remote environments.

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

set -e

# Install dependencies
bun install

# Set up database
bun db:migrate
bun db:seed

# Install Playwright browsers for E2E testing
bunx playwright install --with-deps chromium

echo "Sandbox setup complete!"
