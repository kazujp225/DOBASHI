#!/usr/bin/env bash
# Render build script

set -o errexit

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create necessary directories
mkdir -p data
mkdir -p data/cache
mkdir -p logs
mkdir -p static

# Copy initial data files if they exist in the repo
if [ -f "../data/tigers.json" ]; then
    cp ../data/tigers.json data/
fi

if [ -f "../data/aliases.json" ]; then
    cp ../data/aliases.json data/
fi

echo "Build completed successfully!"
