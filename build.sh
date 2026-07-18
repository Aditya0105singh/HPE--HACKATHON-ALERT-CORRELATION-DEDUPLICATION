#!/usr/bin/env bash
set -euo pipefail

# 1. Install CPU-only PyTorch from the dedicated index.
#    --index-url REPLACES PyPI for this install, so pip can't pull CUDA wheels.
pip install torch --index-url https://download.pytorch.org/whl/cpu

# 2. Install sentence-transformers (needs torch already present).
pip install sentence-transformers>=2.6

# 3. Install everything else from the normal requirements file.
pip install -r backend/requirements.txt
