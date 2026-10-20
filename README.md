# OmniRoute | Ecosystem Customisation & Operations Vault

**Version of reference:** OmniRoute 3.8.52 | **Baseline audited:** 2026-10-19; upgrade verified 2026-10-20 | **Documentation status:** source-verified, with pending verification clearly marked.

This is the central, serially organised engineering vault for OmniRoute and its integrations with Antigravity, Obsidian/Voice Assistant, CodeMap, Voice-PC-Agent, Edge-TTS Voice Engine, and future applications. It includes operational instructions, an environment-specific private path registry, current configuration summaries, safeguards, recovery, test procedures and improvement backlog.

**Start here:** [00.01 Scope and Ground Rules](00_Start_Here/00.01_Scope_and_Ground_Rules.md), [00.02 Verified Status](00_Start_Here/00.02_Verified_Status.md) and the [full serialized document index](00_Start_Here/00.04_Vault_File_Index.md). Use 11_Roadmap_and_Change_Log for future work.

## Folder index
| Folder | Purpose |
|---|---|
| 00_Start_Here | Scope, status, reading guide |
| 01_System_Architecture | Ports, traffic flow, startup, paths |
| 02_Runtime_And_Settings | Verified settings and sanitized runtime snapshots |
| 03_Model_Routing_And_Combos | Virtual auto routes, saved Combos, model quality and fallback rules |
| 04_API_Keys_And_Clients | Key roles, permissions, recovery, risk controls |
| 05_Integrations | Each connected app and planned integrations |
| 06_Model_Inventory_Dashboard | Companion interface, catalog/test workflow |
| 07_Compression_Traffic_Quotas | Compression policy, monitoring and throttling |
| 08_Security_Backup_Recovery | Secrets, database safety and incident recovery |
| 09_Provider_Research | Connected/unconnected inventory and provider onboarding |
| 10_Testing_And_Quality | Acceptance checks, Stratum audit lessons and agent work contract |
| 11_Roadmap_and_Change_Log | Changes, decisions, unresolved items and priorities |
| 12_Reusable_Templates | Onboarding, evaluation and maintenance checklists |
| 13_Maintenance_Scripts | Safe snapshot refresh and vault validation tools |
| 14_Standalone_Companion_Source | Reusable localhost model-inventory source and guide |

## Critical operating rules
- Never commit real keys, tokens, cookies, OAuth material, .env files, local databases, logs, backups or private machine path maps to GitHub.
- Do not infer runtime success solely from saved SQLite configuration: verify the live service, logged model, quota and real inference.
- Treat all model/provider free-tier information as subject to change. Free-tier candidates are not proof of zero billing.
- Do not delete existing working API keys, Combos or providers without dependency analysis and a verified rollback.
- This vault contains documentation and safe metadata, not the live OmniRoute installation. Edits to Markdown do not configure OmniRoute.
- Keep the private credentials document outside this vault and never publish it.

## Local dashboards
- OmniRoute: http://127.0.0.1:20128/dashboard
- Model Inventory companion: http://127.0.0.1:20129/models
- Antigravity Desktop model proxy: http://127.0.0.1:50999/_addon/
- Antigravity IDE model proxy: http://127.0.0.1:51002/_addon/

## Current open risks
1. Strict zero-cost policy was saved but complete post-restart, paid-only-ID, and fallback testing are not yet established.
2. Recent live logs showed failing provider/model combinations, including HuggingChat 502 and Gemini 429.
3. Scarce NVIDIA free credit is not yet protected by a universal explicit reserve allowlist across every route.
4. Antigravity, CodeMap and Voice-PC-Agent quality and key-authenticated generation still require targeted validation.
5. The API-key reveal feature is currently enabled on an authenticated local management endpoint; disable after securely recording keys.
6. Saved Combos contain NVIDIA, AGY and HuggingChat entries; their free/quality/policy status requires individual review.

**Public-repository note:** The machine-specific path register is intentionally in a .local.md file and excluded from Git. All source and snapshots should be reviewed before publishing.
