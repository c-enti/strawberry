#!/bin/bash

# Kill any existing Node processes
pkill -f "node"

# Clear Node's module cache
rm -rf .next/cache

# Set Node.js options for better memory management
export NODE_OPTIONS="--max-old-space-size=16384 --expose-gc"

# Start Next.js with increased heap limits
NODE_ENV=production exec node --max-old-space-size=16384 node_modules/next/dist/bin/next dev
