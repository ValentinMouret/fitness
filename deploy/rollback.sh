#!/bin/bash
set -e

# Fitness App - Rollback Script
# Emergency rollback to the previous version

APP_NAME="fitness"
DEPLOY_USER="deploy"
APP_ROOT="/home/$DEPLOY_USER/$APP_NAME"
RELEASES_DIR="$APP_ROOT/releases"
CURRENT_LINK="$APP_ROOT/current"

echo "🔄 Starting emergency rollback for $APP_NAME"

# Check if we have releases
if [ ! -d "$RELEASES_DIR" ]; then
    echo "❌ No releases directory found at $RELEASES_DIR"
    exit 1
fi

# Get the second most recent release (previous version)
PREVIOUS_RELEASE=$(ls -t "$RELEASES_DIR" | sed -n '2p')

if [ -z "$PREVIOUS_RELEASE" ]; then
    echo "❌ No previous release found to rollback to"
    exit 1
fi

PREVIOUS_RELEASE_DIR="$RELEASES_DIR/$PREVIOUS_RELEASE"

echo "📁 Rolling back to: $PREVIOUS_RELEASE"
echo "📍 Release directory: $PREVIOUS_RELEASE_DIR"

# Verify the previous release exists and has the built app
if [ ! -f "$PREVIOUS_RELEASE_DIR/build/server/index.js" ]; then
    echo "❌ Previous release is incomplete - missing server file"
    exit 1
fi

# Update PM2 configuration for the previous release
echo "🔄 Updating PM2 configuration..."
cp "$PREVIOUS_RELEASE_DIR/ecosystem.config.js" /tmp/ecosystem.config.js
sed -i "s|script: './build/server/index.js'|script: '$PREVIOUS_RELEASE_DIR/build/server/index.js'|" /tmp/ecosystem.config.js

# Update current symlink
echo "🔗 Updating current symlink..."
ln -sfn "$PREVIOUS_RELEASE_DIR" "$CURRENT_LINK"

# Reload PM2 with the previous version
echo "🔄 Reloading PM2 with previous version..."
pm2 reload /tmp/ecosystem.config.js --update-env

# Verify rollback
echo "🔍 Verifying rollback..."
sleep 5
if pm2 list | grep -q "$APP_NAME.*online"; then
    echo "✅ Rollback completed successfully!"
    echo "📁 Current version: $PREVIOUS_RELEASE"
    echo "🌐 Application is running at: https://fitness.valentinmouret.io"
    echo ""
    echo "⚠️  Remember to investigate and fix the issue that caused the rollback"
else
    echo "❌ Rollback failed - PM2 process not running"
    exit 1
fi

echo "📊 Rollback completed at $(date)"