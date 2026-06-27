#!/bin/sh
set -e

# Apply any pending migrations before the app starts, so a fresh environment
# comes up fully provisioned. migrate deploy only applies committed migrations
# (never generates new ones) and is safe to run on every boot.
echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node dist/main
