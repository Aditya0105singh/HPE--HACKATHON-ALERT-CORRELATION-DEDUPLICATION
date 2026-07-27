#!/bin/sh

# Then run the build
echo "Env vars:"
env
echo "Building"
NODE_OPTIONS="--max-old-space-size=4096" next build
