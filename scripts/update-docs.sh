#! /usr/bin/env bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

# Run the JavaScript file
echo "Updating documentation..."
WORKSPACE_PATH="$WORKSPACE_DIR" node "$SCRIPT_DIR/update-docs.js"
