#!/bin/bash
set -e

echo "Installing dependencies with npm install..."
npm install

echo "Building the project..."
npm run build
