#!/bin/bash
set -e

# Fitness App - Server Setup Script
# Run this script once on your Ubuntu VPS to set up the deployment environment

echo "🏃‍♂️ Setting up server for fitness.valentinmouret.io deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "🔧 Installing required packages..."
sudo apt install -y curl git postgresql postgresql-contrib ufw fail2ban

# Install Node.js 22
echo "📦 Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
echo "📦 Installing pnpm..."
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# Install PM2 globally
echo "🔄 Installing PM2..."
sudo npm install -g pm2

# Install Caddy
echo "🌐 Installing Caddy..."
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# Create deployment user
echo "👤 Creating deployment user..."
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy

# Set up directory structure
echo "📁 Setting up directory structure..."
sudo mkdir -p /home/deploy/fitness
sudo mkdir -p /home/deploy/fitness/releases
sudo mkdir -p /home/deploy/fitness/shared
sudo mkdir -p /home/deploy/fitness/shared/logs
sudo mkdir -p /var/log/fitness

# Create bare git repository
echo "📁 Setting up git repository..."
sudo -u deploy git init --bare /home/deploy/fitness.git

# Set up PostgreSQL
echo "🗃️ Setting up PostgreSQL..."
sudo -u postgres createuser deploy
sudo -u postgres createdb fitness_production
sudo -u postgres psql -c "ALTER USER deploy CREATEDB;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fitness_production TO deploy;"

# Set up firewall
echo "🔒 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Enable fail2ban
echo "🔒 Enabling fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Set ownership
echo "🔑 Setting permissions..."
sudo chown -R deploy:deploy /home/deploy
sudo chown -R deploy:deploy /var/log/fitness

# Enable PM2 startup
echo "🔄 Setting up PM2 startup..."
sudo -u deploy pm2 startup
echo "⚠️  Please run the command shown above as root when prompted"

echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy the generated startup command and run it as root"
echo "2. Create /home/deploy/fitness/shared/.env.production with your environment variables"
echo "3. Add production git remote locally: git remote add production deploy@your-server:/home/deploy/fitness.git"
echo "4. Deploy with: git push production main"