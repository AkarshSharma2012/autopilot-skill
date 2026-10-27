# Receipts, markers, and verification

Node 22+ is optional for the workflow but required for the bundled CLI. No npm packages are needed.

## Produce a receipt

`node <skill-folder>/scripts/autopilot.mjs seal --file <artifact>`

This creates `<artifact>.autopilot.json` using a per-installation Ed25519 key. The key is stored outside the repository in the user's `.autopilot/identity` directory. Never upload or commit private keys. On Windows use an account-private directory; file mode bits alone do not establish a Windows ACL. A caller may supply `--identity <private-directory>` for their managed key location.

For a repository stage intended changes, then use `seal-repo --project <repo>`. The CLI seals Git-indexed regular-file blobs, excluding `.autopilot`, `.openai`, and key-like files, into `.autopilot/provenance.json`. Unstaged eligible changes are refused. This accounts for Git line-ending conversion. Review the indexed-file list before publishing; Git-tracked secrets are still secrets. Git is required. Commit the unchanged index and explicitly include the receipt if public verification is desired. Future source changes require a new receipt.

Opt-in PNG metadata: `seal --file image.png --embed-png`. This embeds the signed receipt as a PNG text chunk while preserving image pixels; a detached receipt is also written. The digest is computed after removing only Autopilot receipt chunks. Metadata stripping, lossy conversion, screenshots, and crops may remove provenance. Their result is unknown, never a negative attribution.

`badge --receipt <receipt> --output <badge.svg>` creates a separate visible badge. It is attribution, not cryptographic proof by itself. A visible `AP1:<receipt-id>` marker can also be included when the format and user permit it.

## Verify

`verify --file <artifact> --receipt <receipt> [--trust <public-key.pem>]`

PNG files containing the embedded receipt can omit `--receipt`. Repo verification uses `verify-repo --project <repo> --receipt <receipt> [--trust <public-key.pem>]`.

The website accepts local files, pasted text/code, receipts, and public URLs. It verifies locally in the visitor's browser. URL mode sends the entered URL to its host; GitHub mode uses public GitHub endpoints. No artifact-upload service or central registry exists.

Verify the full public-key fingerprint through an independent channel before trusting it. A receipt carrying its own public key establishes integrity and a self-signed declaration, not identity. Anyone can create a signing key and declare Autopilot use. A valid receipt alone cannot prove which tools produced an artifact. Report trusted signature only after the verifier pins a known key, and retain that limitation.

Any missing receipt, inaccessible URL, unsupported image metadata, changed bytes, malformed receipt, or invalid signature must be reported accurately. Do not use stylistic guessing, AI probability scores, OCR guesses, or marker matches as proof.
