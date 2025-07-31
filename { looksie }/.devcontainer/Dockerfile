# Use a base image that devcontainer.json features can enhance.
# The 'universal' image is often a good starting point, or a specific Node.js image.
# The features defined in devcontainer.json will be applied ON TOP of this base.
FROM mcr.microsoft.com/devcontainers/universal:2

# You generally don't need much here if features handle installations.
# Install PostgreSQL client manually (since the feature is not working)
RUN apt-get update && \
    apt-get -y install --no-install-recommends postgresql-client && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# If you needed specific OS packages (e.g., for PDF/image generation), add them here:
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package> \
#     && apt-get clean && rm -rf /var/lib/apt/lists/*

# Enables reliable headless browser testing
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends xvfb \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# The rest is handled by devcontainer.json (features, commands, settings, etc.)
