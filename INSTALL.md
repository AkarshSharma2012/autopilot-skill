# Install Autopilot

Inspect the repository before executing scripts. Use a normal user shell, not administrator mode. Node 22+ is required only for the installer and provenance tools. No dependencies are downloaded by these scripts.

```sh
git clone https://github.com/AkarshSharma2012/autopilot-skill.git
cd autopilot-skill
node scripts/install.mjs --host claude
```

Choose `--host codex`, `--host agents`, or `--target <documented-host-skill-directory>` instead when appropriate. Do not install duplicate copies into multiple discovery directories for the same host. Existing skills are preserved by default. To replace one after reviewing the update, add `--replace`; a timestamped backup under the user's `.autopilot/backups` directory is created first, outside skill discovery. Symlink targets are refused; choose the intended real directory explicitly.

Without Node, copy `skills/autopilot` to the host's documented skill directory using native file tools. Keep all references and scripts together. If the host cannot install skills, read `skills/autopilot/SKILL.md` explicitly for the task; explain that this is a session workflow.

For Claude Chat/Cowork, ZIP `skills/autopilot` so the archive root is `autopilot/SKILL.md` plus its subdirectories. Upload through the account's skill interface and enable it. Uploading instructions does not connect local MCPs or grant local filesystem access.

## First task

Ask **Use Autopilot to [your goal]**, or `/autopilot [goal]` in a host that exposes the command. Setup happens inside this first invocation: inspect project instructions and manifests, inventory tools visible to the agent, select a route, save project context when possible, and explain usage. A ready-to-use Node scanner is bundled:

```sh
node <installed-skill>/scripts/autopilot.mjs setup --project <project-folder>
```

The scanner detects manifest indicators. The agent must add its actual capability inventory and inspect the project before choosing commands. The scanner does not read account credentials or install plugins. `.autopilot/context.json` is local state; keep it out of public Git. No profile persists when the host has no filesystem access.

Setup ends with a compact guide covering the detected stack, usable tools, missing capabilities, invocation examples, research mode, and receipts. Ask **Autopilot help** to see the guide again.

Research efforts are `low`, `medium`, `high`, and `max`. Example: `/autopilot research max compare current providers and create a spreadsheet`. These control workflow depth, not the model's own reasoning setting or subscription limit.

Make your own reusable workflows with `/autopilot makecommand <what it does and what it is for>`. The agent chooses/explains a safe name and saves a private project-local definition, then shows `/autopilot <name> <inputs>` and the plain-language fallback. Creation does not execute the command or register native host commands universally. Definitions are not silently overwritten; see [commands](skills/autopilot/references/commands.md).

For robotics, independently install [FRCstack](https://github.com/AkarshSharma2012/FRCstack-skill), then use `/autopilot frc <request>`. This routes the domain workflow with one orchestration owner, not a loop between skills. Actual CAD/video/API access still needs to be available and tested.

## Updating and removing

Review changes, pull the repository, then rerun the installer with `--replace`. The backup can be restored by copying it back after stopping the host. To uninstall, remove only the installed skill folder; no hooks, services, scheduled jobs, accounts, or global instruction files were modified. Keep any signing identity if you still need to sign updates or verify its fingerprint. Public receipts and public keys remain independently verifiable.
