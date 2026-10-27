# Provenance contract v1

The receipt is `{payload, publicKey, signature}`. `publicKey` is base64 SPKI Ed25519 DER. `signature` is base64 Ed25519 over UTF-8 canonical JSON of the payload (sorted object keys, ordered arrays, JSON scalar encoding). The protocol accepts bounded JSON fields; signatures cover every payload field.

The payload records protocol, algorithm, claim, random receipt ID, creation time supplied by the local clock, artifact kind, digest, and either file normalization or a repository manifest. The timestamp is signed but not independently timestamped. No prompt, account, user name, private path, or model identity is recorded.

File digests use SHA-256 of exact bytes. PNGs optionally use `png-without-autopilot-chunk-v1`: remove only a `tEXt` chunk named `AutopilotReceipt`, preserve all remaining chunks verbatim, then hash. The receipt chunk contains base64 UTF-8 JSON. PNG checksums and framing are validated. Multiple receipt chunks are refused. Re-encoding can invalidate or remove provenance even if pixels look identical.

Repositories use SHA-256 over canonical JSON of a path-sorted list of `{path,size,sha256}` entries. Only Git-indexed regular-file blobs are sealed, so CRLF conversion and Git clean filters are reflected in the bytes that will be committed. Unstaged eligible changes are refused during sealing; local verification detects working-tree changes as a mismatch. Stage changes before sealing, then commit the index together with the receipt. `.autopilot/`, `.openai/`, `.env*`, and `.pem`/`.key` files are excluded. Symlinks and submodules are unsupported. This is an explicit scope restriction; excluded files are not authenticated. Private content must not be published merely to make a receipt public. Review Git's tracked list.

The browser resolves a public GitHub repository to one immutable commit, fetches its receipt and complete eligible tree at that commit, hashes the content, and verifies the manifest signature. Missing and newly added eligible files are detected. The local CLI refuses assume-unchanged and skip-worktree flags that could hide working-tree changes. Limits are 1,000 files and 32 MiB total. API rate limits and unavailable CORS are reported, not bypassed. A static site cannot read arbitrary private repositories or evade another site's browser restrictions.

## Trust states

| State | Meaning |
| --- | --- |
| Trusted | Signature and artifact match a separately supplied trusted public key |
| Self-signed | Valid signature and artifact match; signer identity is unverified |
| Marker only | AP1 receipt ID appears, but no cryptographic evidence is supplied |
| Mismatch | Valid signature exists, but the bytes or file manifest differ |
| Invalid | Malformed or unsupported receipt, invalid key, corrupt PNG, or invalid signature |
| Unknown | No usable provenance was found |
| Cannot inspect | Network, input, size, or browser-capability error prevents verification |

None of these states independently establishes how an artifact was generated. A signer can make a false workflow claim. “Trusted” means trusted key, not a guarantee of workflow compliance. Verifiers must obtain that key through an independent trusted channel; the key inside the receipt cannot trust itself.

Visible SVG badges and `AP1:<uuid>` markers can be copied. They are useful labels, not proof. This tool intentionally provides no style classifier or invented confidence score. Screenshots without original metadata or a separately matching receipt remain unknown. There is no central lookup for receipt IDs, no user tracking, and no remote private-key service.
