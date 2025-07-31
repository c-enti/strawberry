# .devcontainer

This folder contains configuration files for VS Code Dev Containers and Codespaces.

## Purpose

- Provides a consistent, reproducible development environment for all contributors.
- Includes Dockerfile, devcontainer.json, and related setup files.
- Includes pre-installed VS Code extensions for Node.js, linting, formatting, Docker, Prisma, PostgreSQL, REST client, Tailwind CSS, and GitHub Copilot to streamline development.

## Technical Specification Summary

- **Containerization:** Docker-based dev environment for consistency and reproducibility.
- **Services:**
  - `app`: Main dev environment, mounts repo, exposes ports 3000 (frontend), 5000 (backend), 5432 (Postgres)
  - `db`: PostgreSQL 15, persistent volume, healthcheck, secrets for credentials
- **Features:** Node.js (LTS), GitHub CLI, Zsh, common utilities
- **VS Code Extensions:** Node.js, linting, formatting, Docker, Prisma, PostgreSQL, REST client, Tailwind CSS, GitHub Copilot
- **Environment:** All secrets (DB, API keys) are injected via environment variables, never hardcoded
- **Usage:** Open in VS Code and use "Reopen in Container" or Codespaces for a ready-to-code environment

## Usage

Open the project in VS Code and use the "Reopen in Container" feature, or use GitHub Codespaces for cloud-based development.

See the main project README and CONTRIBUTING.md for more details.
