#!/bin/sh
set -e

echo "🚀 Starting Plunk with Nginx reverse proxy..."
echo "📦 Service: ${SERVICE:-all}"

if [ "$SERVICE" != "all" ]; then
    echo "⚠️  This nginx-enabled image only supports SERVICE=all"
    exit 1
fi

echo "⏭️  Skipping database migrations (SKIP_MIGRATIONS=true)"

. /app/docker/nginx/setup-nginx.sh

echo "🔍 Domain configuration:"
echo "   API_DOMAIN=${API_DOMAIN}"
echo "   DASHBOARD_DOMAIN=${DASHBOARD_DOMAIN}"
echo "   LANDING_DOMAIN=${LANDING_DOMAIN}"
echo "   WIKI_DOMAIN=${WIKI_DOMAIN}"
echo "   USE_HTTPS=${USE_HTTPS}"
echo ""
echo "🔗 Generated URIs:"
echo "   API_URI=${API_URI}"
echo "   DASHBOARD_URI=${DASHBOARD_URI}"
echo "   LANDING_URI=${LANDING_URI}"
echo "   WIKI_URI=${WIKI_URI}"

if [ -f "/app/apps/wiki/.next/standalone/apps/wiki/openapi.local.json" ]; then
  echo "   ✅ openapi.local.json found in standalone directory"
else
  echo "   ❌ WARNING: openapi.local.json not found! API pages will not work."
fi

. /app/docker/replace-urls-optimized.sh

replace_urls_in_app "web" "/app/apps/web/.next/standalone/apps/web"
replace_urls_in_app "landing" "/app/apps/landing/.next/standalone/apps/landing"
replace_urls_in_app "wiki" "/app/apps/wiki/.next/standalone/apps/wiki"

echo "📋 Starting services with PM2..."

cat > /tmp/ecosystem.config.js << PMEOF
module.exports = {
  apps: [
    {
      name: 'nginx',
      script: 'nginx',
      args: '-g "daemon off;"',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false
    },
    {
      name: 'api',
      script: '/app/apps/api/dist/app.js',
      cwd: '/app',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        API_URI: '${API_URI}',
        DASHBOARD_URI: '${DASHBOARD_URI}',
        LANDING_URI: '${LANDING_URI}',
        WIKI_URI: '${WIKI_URI}'
      }
    },
    {
      name: 'worker',
      script: '/app/apps/api/dist/jobs/worker.js',
      cwd: '/app',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        API_URI: '${API_URI}',
        DASHBOARD_URI: '${DASHBOARD_URI}',
        LANDING_URI: '${LANDING_URI}',
        WIKI_URI: '${WIKI_URI}'
      }
    },
    {
      name: 'smtp',
      script: '/app/apps/smtp/dist/server.js',
      cwd: '/app',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        API_URI: '${API_URI}',
        SMTP_DOMAIN: '${SMTP_DOMAIN:-}',
        PORT_SECURE: '465',
        PORT_SUBMISSION: '587',
        MAX_RECIPIENTS: '${MAX_RECIPIENTS:-5}',
        CERT_PATH: '/certs',
        ACME_JSON_PATH: '/certs/acme.json'
      }
    },
    {
      name: 'web',
      script: 'apps/web/server.js',
      cwd: '/app/apps/web/.next/standalone',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        API_URI: '${API_URI}',
        DASHBOARD_URI: '${DASHBOARD_URI}',
        LANDING_URI: '${LANDING_URI}',
        WIKI_URI: '${WIKI_URI}'
      }
    },
    {
      name: 'landing',
      script: 'apps/landing/server.js',
      cwd: '/app/apps/landing/.next/standalone',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOSTNAME: '0.0.0.0',
        API_URI: '${API_URI}',
        DASHBOARD_URI: '${DASHBOARD_URI}',
        LANDING_URI: '${LANDING_URI}',
        WIKI_URI: '${WIKI_URI}',
        PLUNK_API_KEY: '${PLUNK_API_KEY:-}'
      }
    },
    {
      name: 'wiki',
      script: 'apps/wiki/server.js',
      cwd: '/app/apps/wiki/.next/standalone',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 1000,
        HOSTNAME: '0.0.0.0',
        API_URI: '${API_URI}',
        DASHBOARD_URI: '${DASHBOARD_URI}',
        LANDING_URI: '${LANDING_URI}',
        WIKI_URI: '${WIKI_URI}'
      }
    }
  ]
};
PMEOF

echo ""
echo "✅ Configuration complete!"
echo "🚀 Starting all services..."
echo ""

exec pm2-runtime start /tmp/ecosystem.config.js
