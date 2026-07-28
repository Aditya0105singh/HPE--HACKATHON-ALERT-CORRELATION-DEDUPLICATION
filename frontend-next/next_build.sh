#!/bin/sh

# NOTE: upstream KeepHQ dumped the full environment here (`env`) for debugging.
# That prints every build-time variable into the deploy log, including tokens
# the host does not redact, so it is deliberately not done.

# Vercel's build container has 8 GB. Node's default heap is far below what
# this tree needs (Monaco, the workflow builder and the Keep component set),
# so raise it while leaving headroom for the OS. Lowering this causes the
# build to OOM sooner, not later.
NODE_OPTIONS="--max-old-space-size=7168" next build
