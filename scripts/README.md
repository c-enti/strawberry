# Documentation Update Scripts

This directory contains scripts for automatically updating and synchronizing documentation across the project.

## Main Components

- `update-docs.ts`: TypeScript implementation of the documentation updater
- `update-docs.sh`: Shell script wrapper for running the TypeScript updater

## Integration Options

### 1. Git Pre-commit Hook (Currently Implemented)

The documentation updater runs automatically before each commit via a git pre-commit hook.
This ensures documentation stays synchronized with code changes.

To temporarily skip the pre-commit hook:

```bash
git commit -m "your message" --no-verify
```

### 2. VS Code Task Integration

You can add this task to your `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Update Documentation",
      "type": "shell",
      "command": "npm run update-docs",
      "group": {
        "kind": "build",
        "isDefault": false
      },
      "presentation": {
        "reveal": "always",
        "panel": "shared"
      }
    }
  ]
}
```

Then run it via:

1. `Cmd/Ctrl + Shift + P`
2. Type "Run Task"
3. Select "Update Documentation"

### 3. CI/CD Pipeline Integration

Add to your GitHub Actions workflow (example):

```yaml
- name: Update Documentation
  run: |
    npm ci
    npm run update-docs
    # Optional: Create PR if changes detected
    if [[ -n "$(git status --porcelain)" ]]; then
      git config user.name "GitHub Actions Bot"
      git config user.email "<>"
      git add docs/
      git commit -m "docs: Update documentation status [skip ci]"
      git push
    fi
```

## How It Works

The documentation updater:

1. Reads `NEXT_STEPS.md` for recently completed tasks
2. Updates matching tasks in `MVP_CHECKLIST.md`
3. Propagates milestone updates to `ROADMAP.md`

### File Relationships

```
NEXT_STEPS.md → MVP_CHECKLIST.md → ROADMAP.md
(immediate tasks) (development phases) (high-level milestones)
```

## Manual Usage

Run the updater manually:

```bash
npm run update-docs
```

## Development

To modify the updater:

1. Edit `update-docs.ts` for the core logic
2. Edit `update-docs.sh` for the shell wrapper
3. Run tests (when added) with `npm test`

Remember to update this README when making significant changes to the scripts.
