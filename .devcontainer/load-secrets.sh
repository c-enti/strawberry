#!/bin/bash

# Load secrets from secrets.json and export as env vars
jq -r 'to_entries[] | "export \(.key)=\(.value)"' /workspaces/secrets.json >> /etc/profile.d/load-secrets.sh
