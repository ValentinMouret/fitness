# Deployment Guide

This directory contains all the deployment configuration for the fitness app to be deployed on `fitness.valentinmouret.io`.

## Prerequisites

- Ubuntu VPS with root access
- Domain `valentinmouret.io` with DNS pointing to your VPS
- SSH access to your VPS

## Initial Server Setup

1. **Run the server setup script** (once only):
   ```bash
   # Copy setup script to your VPS
   scp deploy/setup-server.sh root@your-vps:/tmp/
   
   # SSH into your VPS and run setup
   ssh root@your-vps
   chmod +x /tmp/setup-server.sh
   ./tmp/setup-server.sh
   ```

2. **Complete the PM2 setup**:
   ```bash
   # Run the PM2 startup command shown by the setup script (as root)
   sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u deploy --hp /home/deploy
   ```

3. **Configure environment variables**:
   ```bash
   # Copy and edit the environment file
   sudo cp /path/to/your/repo/deploy/.env.production.example /home/deploy/fitness/shared/.env.production
   sudo nano /home/deploy/fitness/shared/.env.production
   # Edit with your actual values
   sudo chown deploy:deploy /home/deploy/fitness/shared/.env.production
   ```

4. **Set up Caddy**:
   ```bash
   # Copy Caddy configuration
   sudo cp /path/to/your/repo/deploy/Caddyfile /etc/caddy/Caddyfile
   
   # Test and reload Caddy
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

5. **Set up Git hooks**:
   ```bash
   # Copy the post-receive hook
   sudo cp /path/to/your/repo/deploy/post-receive /home/deploy/fitness.git/hooks/
   sudo chmod +x /home/deploy/fitness.git/hooks/post-receive
   sudo chown deploy:deploy /home/deploy/fitness.git/hooks/post-receive
   ```

## Local Setup

1. **Add production remote**:
   ```bash
   git remote add production deploy@your-vps:/home/deploy/fitness.git
   ```

## Deployment

Deploy to production by pushing to the main branch:

```bash
git push production main
```

This will automatically:
- Clone the latest code
- Install dependencies
- Build the application
- Run database migrations
- Reload PM2 with zero downtime

## Monitoring

- **Application logs**: `ssh deploy@your-vps "pm2 logs fitness"`
- **Application status**: `ssh deploy@your-vps "pm2 status"`
- **Health check**: `curl https://fitness.valentinmouret.io/health`
- **Caddy logs**: `sudo journalctl -u caddy -f`

## Emergency Rollback

If something goes wrong with a deployment:

```bash
ssh deploy@your-vps "/home/deploy/fitness-rr/deploy/rollback.sh"
```

## File Structure on Server

```
/home/deploy/
├── fitness.git/              # Bare git repository
│   └── hooks/
│       └── post-receive      # Deployment trigger
├── fitness/
│   ├── current/              # Symlink to active version
│   ├── releases/             # All deployment versions
│   │   ├── 20250116-1234/
│   │   ├── 20250116-1235/
│   │   └── 20250116-1236/
│   └── shared/
│       ├── .env.production   # Environment variables
│       └── logs/             # Shared logs
└── fitness-rr/               # This repository (for scripts)
    └── deploy/
        ├── deploy.sh
        └── rollback.sh
```

## Troubleshooting

### Deployment fails
1. Check the git hook output: `git push production main`
2. SSH into server and check logs: `sudo journalctl -u caddy -f`
3. Check PM2 status: `ssh deploy@your-vps "pm2 status"`

### Application won't start
1. Check PM2 logs: `ssh deploy@your-vps "pm2 logs fitness"`
2. Verify environment variables are set correctly
3. Check database connectivity

### Database issues
1. Ensure PostgreSQL is running: `sudo systemctl status postgresql`
2. Test database connection: `psql $DATABASE_URL -c "SELECT 1;"`
3. Check migration status: `ssh deploy@your-vps "cd /home/deploy/fitness/current && pnpm run db:migrate"`

### SSL/Domain issues
1. Check Caddy status: `sudo systemctl status caddy`
2. Test Caddy config: `sudo caddy validate --config /etc/caddy/Caddyfile`
3. Check DNS resolution: `dig fitness.valentinmouret.io`