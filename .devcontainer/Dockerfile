# .devcontainer/Dockerfile

# 1. Start from the official Microsoft Dev Container image for Node.js.
# This image includes Node.js, npm, and other common development tools.
# The ":22-bullseye" tag specifies Node.js 22 on the Debian Bullseye OS.
# This line directly corresponds to the "image" property from your original devcontainer.json.
FROM mcr.microsoft.com/devcontainers/javascript-node:22-bullseye

# 2. [Optional] Add any custom OS-level dependencies here.
# For example, if you needed to install another tool via apt-get, you would do it here.
# The "ARG" lines are a best practice for dev containers to avoid unnecessary rebuilds.
#
# ARG INSTALL_ZSH="false"
# RUN if [ "${INSTALL_ZSH}" = "true" ]; then \
#     apt-get update && export DEBIAN_FRONTEND=noninteractive && apt-get -y install zsh; \
#   fi

RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# 3. [Optional] You can add other setup commands here.
# For example, installing global npm packages.
#
# RUN su node -c "npm install -g pnpm"

# This Dockerfile is intentionally simple because the base image is very capable.
# You only need to add lines here if you want to customize the container's
# operating system or install global tools beyond what the base image provides.