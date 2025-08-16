#!/bin/bash
set -e

# Fitness App - Deployment Script
# This script handles the actual deployment process

APP_NAME="fitness"
DEPLOY_USER="deploy"
APP_ROOT="/home/$DEPLOY_USER/$APP_NAME"
REPO_ROOT="/home/$DEPLOY_USER/$APP_NAME.git"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"

# Create timestamp for this release
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"

echo "🏃‍♂️ Starting deployment of $APP_NAME at $TIMESTAMP"

# Create release directory
echo "📁 Creating release directory: $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Clone the latest code
echo "📥 Cloning repository..."
git --git-dir="$REPO_ROOT" --work-tree="$RELEASE_DIR" checkout -f

# Link shared files
echo "🔗 Linking shared files..."
ln -sf "$SHARED_DIR/.env.production" "$RELEASE_DIR/.env"
mkdir -p "$RELEASE_DIR/logs"
ln -sf "$SHARED_DIR/logs" "$RELEASE_DIR/logs/shared"

# Install dependencies
echo "📦 Installing dependencies..."
cd "$RELEASE_DIR"
export PATH="/home/$DEPLOY_USER/.local/share/pnpm:$PATH"
pnpm install --frozen-lockfile --prod

# Build the application
echo "🔨 Building application..."
pnpm run build

# Run database migrations
echo "🗃️ Running database migrations..."
pnpm run db:migrate

# Test the build
echo "🧪 Testing the build..."
if [ ! -f "$RELEASE_DIR/build/server/index.js" ]; then
    echo "❌ Build failed: server file not found"
    exit 1
fi

# Update PM2 configuration
echo "🔄 Updating PM2 configuration..."
cp "$RELEASE_DIR/ecosystem.config.js" /tmp/ecosystem.config.js
sed -i "s|script: './build/server/index.js'|script: '$RELEASE_DIR/build/server/index.js'|" /tmp/ecosystem.config.js

# Backup current version (if exists)
if [ -L "$CURRENT_LINK" ]; then
    BACKUP_DIR="$APP_ROOT/backup-$(date +%s)"
    echo "💾 Backing up current version to $BACKUP_DIR"
    cp -L "$CURRENT_LINK" "$BACKUP_DIR" 2>/dev/null || true
fi

# Create/update current symlink
echo "🔗 Updating current symlink..."
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

# Reload PM2 with zero downtime
echo "🔄 Reloading PM2..."
if pm2 list | grep -q "$APP_NAME"; then
    # App already running, reload it
    pm2 reload /tmp/ecosystem.config.js --update-env
else
    # First deployment, start the app
    pm2 start /tmp/ecosystem.config.js
    pm2 save
fi

# Clean up old releases (keep last 3)
echo "🧹 Cleaning up old releases..."
cd "$RELEASES_DIR"
ls -t | tail -n +4 | xargs -r rm -rf

# Verify deployment
echo "🔍 Verifying deployment..."
sleep 5
if pm2 list | grep -q "$APP_NAME.*online"; then
    echo "✅ Deployment successful!"
    echo "🌐 Application is running at: https://fitness.valentinmouret.io"
else
    echo "❌ Deployment failed - PM2 process not running"
    exit 1
fi

echo "📊 Deployment completed at $(date)"
echo "📁 Release directory: $RELEASE_DIR"
echo "🔗 Current link: $CURRENT_LINK"