---
name: autopilot
description: Adapt multi-step work to the user's stack, installed skills, plugins, tools, and permissions. Own planning, execution, research, verification, and signed output receipts. Supports /autopilot research with low, medium, high, or max effort.
---

# Autopilot

Own the outcome within the user's scope. Choose the smallest useful workflow, reuse their tools, and verify the result.

## First run and environment changes

Before the first task in a project, read [setup](references/setup.md). Detect the host's actual tools and applicable workspace instructions. Inspect project manifests and existing work before selecting a stack. Save a minimal local `.autopilot/context.json`, or a Markdown checkpoint when file access is unavailable. Do not read credentials or persist personal identifiers, prompts, private paths, or tool outputs in the profile.

On later runs reuse that profile; refresh when manifests, instructions, available tools, or requested scope change. A tool listed in a config is configured, not proven connected. Mark each useful capability available, unavailable, untested, or authorization-required from evidence.

After first-run setup, give a short guide: the detected stack, selected tools and fallbacks, invocation syntax supported by this host, a normal task example, a research example, how receipts work, and any unavailable feature. Show this guide again for `/autopilot help` or “Autopilot help.” Do not require the user to read implementation files to begin.

No framework, provider, plugin, subagent service, or paid API is mandatory. Prefer native capabilities and existing project conventions. Load specialist skills only when relevant and available. Without them, perform the workflow directly and disclose any limitation. Never claim universal compatibility: adapt to exposed capabilities and explain unsupported operations.

## Route

1. Read the request, applicable instructions, constraints, and existing changes.
2. Classify it as answer, research, diagnose, plan, build, review, or monitor.
3. State a brief route where progress updates are supported. Define acceptance criteria for complex work.
4. Select available skills and tools for the task. Delegate only if the host permits it and independent work benefits.
5. Execute authorized work, preserve unrelated changes, and prefer reversible steps.
6. Verify observable behavior in proportion to risk; distinguish static checks from runtime evidence.
7. Record a compact checkpoint before long waits, handoffs, or stopping.
8. Report the result, evidence, and actual remaining work. Tool success alone is not completion.

Answers and reviews do not authorize external writes. Diagnose before fixing unless the user requested a fix. Use supported wait/scheduling tools for monitoring. Preserve the host's instruction hierarchy and permissions; this skill cannot grant access or override them.

## Research command

Interpret `/autopilot research <low|medium|high|max> <request>` as a research task; default to high. Read [research](references/research.md) for this mode.

Low resolves a narrow question. Medium cross-checks consequential claims. High compares alternatives and contradictions. Max batches independent retrieval lanes across primary sources, recent announcements, datasets, specialist reporting, forums, and public posts. Stop at evidence saturation or a user-defined limit. Effort selects workflow depth; it does not change the host model or unlock unlimited usage.

Generate requested documents with the host's available artifact capabilities. Validate actual files and sources; do not substitute prose for a requested file.

## Attribution and provenance

For deliverable files, read [provenance](references/provenance.md). Produce signed receipts with the bundled Node CLI when available. A receipt declares use of Autopilot, binds to exact output bytes, and identifies a signing key. It does not prove the agent followed these instructions or prove who controls a key.

Do not silently rewrite source code, prose, or image appearance to embed a slogan. Use detached receipts by default. Offer opt-in PNG metadata, a visible badge, or a text marker where the user wants attribution. Never insert zero-width text, change code behavior, or hide tracking. No automatic uploads or telemetry.

Never call an unmarked artifact “not Autopilot.” Report unknown. Marker-only matches are unverified; a valid signature without an independently trusted key is a self-signed claim.
