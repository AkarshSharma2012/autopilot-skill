# First-run adaptation

Run once per project, then refresh when relevant inputs change.

1. Read applicable instructions and inspect stack manifests, lockfiles, build/test commands, directory layout, Git state, and existing conventions. Never assume JavaScript or replace an existing stack.
2. Inventory the tools and skills exposed by the host for filesystem access, execution, browsing/research, artifact creation, testing, version control, deployment, and optional delegation. Do not scan account secrets, personal folders, or every installed plugin. Check relevant capabilities only.
3. Select a minimal route with fallbacks. A missing research plugin falls back to native browsing; missing execution means provide a clearly labeled plan rather than claim files were built. Unsupported deployment remains blocked at the actual deployment step.
4. With Node 22+ and filesystem access, run `node <skill-folder>/scripts/autopilot.mjs setup --project <project-directory>`. This records manifest fingerprints and suggested stack indicators. Add a capability array to the returned profile based on the host's observed tools: `{"name":"native web","status":"available","evidence":"exposed tool"}`. Use only the four statuses in SKILL.md. No automatic server starts, package installs, account connections, or billing changes.
5. Without Node, write the equivalent minimal `.autopilot/context.md` using native file tools. Without filesystem access, keep the setup in the conversation and state it is session-only.

Finish with onboarding tailored to the detected environment: “Ready for [stack]. I can use [observed tools]. Use [supported invocation] for normal work and [research example] for current research. [Unavailable capability] will need [fallback]. Receipts are [enabled or unavailable]. Ask for Autopilot help to see this again.” State only verified capabilities. CLI `help` also prints portable usage examples.

The heuristic scanner is a starting point, not proof of compatibility or tool connectivity. Inspect the relevant files yourself. Save no personal data or credentials. Keep context and signing keys out of public source control. Existing project instructions and user choices take priority.

Installing this skill does not install any plugins. In hosts without slash commands, “Use Autopilot to ...” activates the same workflow when skills are supported. In hosts without skill discovery, explicitly read SKILL.md and its linked references. Do not automatically modify global agent instruction files.
