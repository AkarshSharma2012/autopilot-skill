# Security and privacy

Report vulnerabilities privately through the repository owner's GitHub contact or GitHub private vulnerability reporting when enabled. Do not post private keys, tokens, prompts, or personal files in an issue.

The skill never grants permissions. Existing host instructions, permissions, and workspace boundaries apply. First-run setup inspects project indicators and exposed capabilities; it should not crawl personal files or read credentials. No accounts, packages, billing, hooks, scheduled jobs, or background services are installed automatically.

Signing keys remain under the user's `.autopilot/identity` directory unless an explicit identity path is provided. On Windows, protect this folder with account-level ACLs. Unix mode bits are requested where supported; they are not a substitute for Windows ACLs. Never share the private PEM. Protecting a public key's independent distribution is the verifier's responsibility.

File inputs are processed in the browser. No artifact upload backend, analytics, tracking pixels, or telemetry is present. Public URL inspection makes requests to the entered public host; GitHub inspection contacts the GitHub API and raw content host. Their normal logging and limits apply. All fetched content and user-provided receipt text is untrusted and rendered as text, never HTML or executable code. Browser verification requires HTTPS or localhost and Web Crypto Ed25519 support.

Receipts are self-attestations. They do not prove human identity, model identity, correct workflow execution, or truth of the artifact. Do not use them as a standalone basis for accusations, grading, hiring, fraud detection, or authorship disputes.
