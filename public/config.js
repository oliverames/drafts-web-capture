// CloudKit API token — injected by the Express server at runtime (/config.js route),
// or overwritten by the GitHub Actions deploy workflow from the CLOUDKIT_API_TOKEN secret.
// This file is the static fallback for local development without the server.
window.CLOUDKIT_API_TOKEN = '';
