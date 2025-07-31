#!/bin/zsh
# test-in-container.sh: Run server/ tests inside the devcontainer context, inheriting all environment variables

# Ensure this script is run from the project root
cd "$(dirname "$0")/.."

# Check if we're inside the devcontainer (Codespaces or VS Code Dev Container)
if [ -f "/.devcontainer_marker" ] || [ "$CODESPACES" = "true" ]; then
  echo "[INFO] Running tests inside the devcontainer..."
  cd server && npm test
else
  echo "[ERROR] This script must be run inside the VS Code Dev Container or GitHub Codespace."
  echo "Open the project in a devcontainer and re-run this script."
  exit 1
fi
