# Contributing

Keep Autopilot portable. Improve capability routing instead of assuming a framework, provider, paid API, or plugin. Do not include personal configuration, credentials, local profiles, logs, private keys, or third-party skill bundles of unknown license.

For code changes, run `npm test`, `npm run check`, and `npm run build`. Tests must cover observable behavior, including tampering, missing receipts, untrusted keys, changed project manifests, and network limitations. For skill changes, validate `skills/autopilot` with the host's skill validator when available and check no instruction overrides host/user authority.

Keep UI language precise: trusted key, self-signed claim, marker only, mismatch, invalid, or unknown. Never market this as a universal AI detector or screenshot attribution engine.
