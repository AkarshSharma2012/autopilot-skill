# Autopilot

**Give your agent a goal. Keep a receipt.**

A portable skill that adapts to a project's stack and the host's available skills, plugins, tools, and permissions. It plans, executes, researches, and verifies outcomes. First use inventories the environment and explains the selected setup. Optional signed receipts travel with deliverables.

[Open the verifier](https://autopilot-receipt-desk.creamgrape2051.chatgpt.site) · [Installation](INSTALL.md) · [Provenance contract](docs/PROVENANCE.md) · [Security](SECURITY.md)

## Tell your agent to install it

> Set up the Autopilot skill from https://github.com/AkarshSharma2012/autopilot-skill. Read INSTALL.md, use the installer for this host, preserve my existing configuration, and show me how to use it.

The agent should inspect the source before running the installer. No account connection, paid API, or particular plugin is required. Skill discovery and slash-command support depend on the host. Installing one skill does not grant capabilities the host does not expose.

## Use it

```text
/autopilot build and test this feature
/autopilot research max compare current options and make an Excel workbook
/autopilot help
```

For hosts without slash commands: **Use Autopilot to ...**

First-run setup detects stack indicators, inventories observed tools, selects fallbacks, saves a local profile, and gives an onboarding guide. It does not change the user's stack, install every plugin, or claim disconnected tools work. Existing project instructions, host permissions, and user choices take priority. Profiles are refreshed when relevant inputs change.

| Environment | Integration |
| --- | --- |
| Claude Code | Install to the personal `.claude/skills/autopilot` directory |
| Codex | Install to personal `.codex/skills/autopilot`, or the host's supported shared skills directory |
| Other local agents | Use their documented skill directory through `--target`, or explicitly read SKILL.md |
| Claude Chat / Cowork | Upload a ZIP containing the `autopilot` folder; tools are limited to those exposed in that session |
| No shell / no Node | The instruction workflow still works; bundled signing scripts are unavailable |

These are integration paths, not a claim of live testing in every agent. Node scripts are exercised by CI on Ubuntu and Windows. Every stack is handled by inspection and capability routing, rather than a fixed list of framework adapters.

## Signed output receipts

With Node 22+:

```sh
node skills/autopilot/scripts/autopilot.mjs setup --project .
node skills/autopilot/scripts/autopilot.mjs seal --file report.pdf
node skills/autopilot/scripts/autopilot.mjs verify --file report.pdf --receipt report.pdf.autopilot.json
node skills/autopilot/scripts/autopilot.mjs seal --file illustration.png --embed-png
node skills/autopilot/scripts/autopilot.mjs seal-repo --project .
node skills/autopilot/scripts/autopilot.mjs help
```

The PNG command produces a new `illustration.autopilot.png`; the original is preserved. Detached receipts do not change artifacts. `badge` creates a separate SVG attribution label. All output commands refuse to overwrite existing outputs; choose a fresh `--output` receipt path for subsequent versions. PNG output names must also be fresh. For repository sealing, stage the intended changes first: receipts hash index blobs (including Git line-ending normalization), and unstaged eligible changes are refused.

The verifier checks files, pasted text/code, embedded PNG receipts, public file URLs that permit browser access, and public GitHub repository receipts. Its outcomes distinguish trusted keys, self-signed declarations, marker-only attribution, mismatching bytes, and unknown origin. Local file contents never leave the browser. URL mode contacts the entered host; repo mode contacts GitHub.

**This is not an AI detector.** Anyone can sign a claim of Autopilot use. A receipt proves integrity and a declaration by its signing key, not that instructions were followed or which model made the work. A signature is “trusted” only after the verifier supplies a known public key obtained independently. Screenshots, crops, rewritten prose, or metadata-stripped images can lose provenance. No receipt means **unknown**, never “not Autopilot.” This format does not claim C2PA compatibility.

## Build and test

No npm install is required. The project uses Node's standard library and browser Web Crypto (Ed25519).

```sh
npm test
npm run check
npm run build
npm start
```

Open the printed local URL. The static `dist` folder can be hosted on Sites, GitHub Pages, or any HTTPS static host. `.github/workflows/pages.yml` deploys the public verifier when GitHub Pages is configured to use Actions. The independent CI workflow runs the verification suite on Node 22 and 24, Ubuntu and Windows.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Avoid hard-coded providers, user-specific paths, undisclosed telemetry, hidden textual fingerprints, and unsupported attribution claims. Add behavior tests for protocol or CLI changes. Keep generated signing keys and local profiles private.

MIT licensed. No analytics, central registry, account system, billing integration, or automatic telemetry.
