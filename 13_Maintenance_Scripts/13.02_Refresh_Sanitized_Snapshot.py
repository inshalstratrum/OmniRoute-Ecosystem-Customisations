#!/usr/bin/env python3
"""Refresh allowlisted OmniRoute metadata only. NEVER exports key, token or connection secrets."""
from __future__ import annotations
import collections
import datetime as dt
import json
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = os.environ.get("DATA_DIR")
if not DATA_DIR:
    sys.exit("DATA_DIR is absent. Set it from the correct Windows User environment before running.")
DB_FILE = Path(DATA_DIR) / "storage.sqlite"
if not DB_FILE.is_file() or DB_FILE.drive.lower() != "e:":
    sys.exit("Expected active E: OmniRoute database not found. No documents modified.")
con = sqlite3.connect("file:" + DB_FILE.as_posix() + "?mode=ro", uri=True, timeout=10)
con.row_factory = sqlite3.Row
assert con.execute("pragma quick_check").fetchone()[0] == "ok", "Active DB integrity check failed"
NOW = dt.datetime.now(dt.timezone.utc)
when = NOW.strftime("%Y-%m-%d %H:%M UTC")

def cfg(namespace, key):
    row = con.execute("SELECT value FROM key_value WHERE namespace=? AND key=?", (namespace,key)).fetchone()
    if row is None:
        return None
    # Settings (unlike feature flags) are stored as JSON values.
    if namespace == "feature_flags":
        return row["value"]
    try:
        return json.loads(row["value"])
    except (ValueError,TypeError):
        return row["value"]

def make_json_list(value):
    try:
        x = json.loads(value or "[]")
        return x if isinstance(x,list) else []
    except (TypeError, ValueError):
        return []

def write(rel, text):
    p = ROOT / rel
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(text.rstrip() + "\n", encoding="utf-8",newline="\n")
    print("UPDATED", rel)

settings_whitelist = [
    "hidePaidModels", "freeAccessPolicy", "credentialRedactionEnabled", "requestRetry",
    "maxRetryIntervalSec", "autoRefreshProviderQuota", "autoRefreshProviderQuotaInterval",
    "excludeTosAvoid", "quotaPreflight", "comboStrategy", "requireLogin",
    "logToolSources", "call_log_pipeline_enabled", "alwaysPreserveClientCache",
    "promptCacheAffinityEnabled",
]
compression_whitelist = [
    "enabled", "defaultMode", "stackedPipeline", "preserveSystemPrompt",
    "preserveSystemPromptMode", "cacheMinutes", "mcpAccessibility",
    "mcpDescriptionCompressionEnabled", "activeComboId",
]
settings = {k:cfg("settings", k) for k in settings_whitelist}
compression = {k:cfg("compression",k) for k in compression_whitelist}
flags = {"ALLOW_API_KEY_REVEAL":cfg("feature_flags","ALLOW_API_KEY_REVEAL")}
providers = []
provider_counts = collections.Counter()
for r in con.execute(
    "SELECT provider,is_active,test_status,last_error_type,priority,"
    "max_concurrent,quota_visible,rate_limit_protection,health_check_interval "
    "FROM provider_connections ORDER BY provider,id"
):
    x = dict(r)
    x["provider"] = str(x["provider"] or "unknown")
    provider_counts[x["provider"]] += 1
    x["index_within_provider"] = provider_counts[x["provider"]]
    providers.append(x)
keys = []
for r in con.execute(
    "SELECT name,is_active,model_access_mode,allowed_models,allowed_combos,"
    "blocked_models,compression_enabled,disable_non_public_models,last_used_at "
    "FROM api_keys ORDER BY name"
):
    x = dict(r)
    for field in ("allowed_models","allowed_combos","blocked_models"):
        x[field] = make_json_list(x[field])
    # Do not query key/key_hash/key_prefix/machine_id or any credential columns.
    keys.append(x)
combos = []
for r in con.execute("SELECT name,data FROM combos ORDER BY sort_order"):
    c = json.loads(r["data"] or "{}")
    clean_targets=[]
    for t in c.get("models") or []:
        if isinstance(t, dict):
            clean_targets.append({
                "kind":t.get("kind","model"),
                "provider":t.get("provider"),
                "model":t.get("model"),
            })
        elif isinstance(t,str):
            clean_targets.append({"kind":"model","provider":None,"model":t})
    combos.append({"name":r["name"],"strategy":c.get("strategy"),"targets":clean_targets})

counts = {}
for table in ("provider_connections","api_keys","combos","call_logs","compression_combos","auto_candidate_overrides"):
    try:
        counts[table] = con.execute("SELECT count(*) FROM "+table).fetchone()[0]
    except sqlite3.OperationalError:
        counts[table] = None

snapshot = {
    "about":"Allowlisted, sanitized local OmniRoute configuration; NO credentials, IDs or private connection names",
    "generated_utc":NOW.isoformat(timespec="seconds"),
    "omniroute_installed_version": json.loads((Path(os.environ["APPDATA"])/"npm/node_modules/omniroute/package.json").read_text(encoding="utf-8")).get("version","unknown"),
    "database_location":"E: active DATA_DIR (absolute local path omitted)",
    "counts":counts,
    "settings":settings,
    "compression":compression,
    "feature_flags":flags,
    "provider_types":dict(sorted(provider_counts.items())),
    "provider_connections":providers,
    "api_key_roles":keys,
    "saved_combos":combos,
}
write("02_Runtime_And_Settings/02.04_Sanitized_Config_Snapshot.json",
      json.dumps(snapshot,indent=2,ensure_ascii=False))

provider_lines = [
    "# 02.02 Connected provider summary",
    "", "**Generated:** "+when,
    "", "Source: live active E: database; only approved metadata fields; names, emails and secrets deliberately omitted.",
    "", "| Provider type | Connection count | Active | Connection test flags | Last-error classes |",
    "|---|---:|---:|---|---|",
]
for provider in sorted(provider_counts):
    items = [p for p in providers if p["provider"] == provider]
    active = sum(p["is_active"] == 1 for p in items)
    tests = ", ".join(sorted({str(p["test_status"] or "unknown") for p in items}))
    errors = ", ".join(sorted({str(p["last_error_type"] or "none") for p in items}))
    provider_lines.append(f"| {provider} | {len(items)} | {active} | {tests} | {errors} |")
provider_lines += [
    "", f"**Total:** {len(providers)} connections in {len(provider_counts)} provider types.",
    "", "The active flag is NOT proof of a working model, zero-cost terms or healthy current inference.",
    "NVIDIA is scarce-credit reserve; max_concurrent=1 is saved, but everyday-route exclusion is not yet verified.",
    "No direct Hugging Face Inference provider is listed merely because huggingchat is present.",
]
write("02_Runtime_And_Settings/02.02_Connected_Provider_Summary.md","\n".join(provider_lines))

combo_lines = [
    "# 03.02 Seven saved Combos (verified live)",
    "", "**Generated:** "+when,
    "", "These are persisted Combos, not the dynamically generated auto/best-coding and similar virtual variants.",
    "Model IDs and order are captured; credential IDs, tokens and provider metadata are excluded.",
]
for i, combo in enumerate(combos,1):
    combo_lines += ["",f"## {i}. {combo['name']}",f"**Strategy:** {combo['strategy'] or 'not set'}",
                    "", "| Priority | Provider | Model ID |","|---:|---|---|"]
    for j,target in enumerate(combo["targets"],1):
        combo_lines.append(f"| {j} | {target['provider'] or 'unbound/embedded'} | {target['model'] or '(unknown)'} |")
combo_lines += ["", "**Safety:** Any saved Combo containing NVIDIA or unverified provider models must not be treated as automatically free. Preserve existing clients until reviewed.", ""]
write("03_Model_Routing_And_Combos/03.02_Seven_Saved_Combos.md","\n".join(combo_lines))

key_lines = [
    "# 04.02 Client key permissions (sanitized)",
    "", "**Generated:** "+when,
    "", "Only names and allowlist settings are exported. Full API keys, hashes, GUIDs, machine IDs and per-client secrets are NEVER read by this script.",
    "", "| Client | Active | Model access mode | Compression | Last used record |",
    "|---|---|---|---|---|",
]
for k in keys:
    key_lines.append(f"| {k['name']} | {bool(k['is_active'])} | {k['model_access_mode']} | {bool(k['compression_enabled'])} | {k['last_used_at'] or 'not recorded'} |")
for k in keys:
    key_lines += [
        "", "## "+k["name"],
        "- Allowed models: "+(", ".join(k["allowed_models"]) if k["allowed_models"] else "(all / not explicit)"),
        "- Allowed Combos: "+(", ".join(k["allowed_combos"]) if k["allowed_combos"] else "(none listed)"),
        "- Blocked models: "+(", ".join(k["blocked_models"]) if k["blocked_models"] else "(none listed)"),
        "- Disable non-public models: "+str(bool(k["disable_non_public_models"])),
    ]
key_lines += ["", "**Caution:** Some clients use all-model access and are not protected by a specific allowlist. Check gateway strict-free policy and direct model routing separately."]
write("04_API_Keys_And_Clients/04.02_Client_Key_Permissions.md","\n".join(key_lines))

start = (NOW - dt.timedelta(days=7)).isoformat().replace("+00:00","Z")
traffic = con.execute(
    "SELECT provider,status,count(*) AS calls "
    "FROM call_logs WHERE timestamp>=? GROUP BY provider,status ORDER BY provider,status",
    (start,)
).fetchall()
traffic_lines = [
    "# 07.03 Sanitized request summary",
    "", "**Generated:** "+when,
    "", "Window: past 7 days (based on recorded UTC timestamps). Only aggregated provider/status counts; no prompts, headers, bearer values, URLs or user identifiers.",
    "", "| Provider | HTTP/status | Count |",
    "|---|---|---:|",
]
for r in traffic:
    traffic_lines.append(f"| {r['provider'] or 'unknown'} | {r['status']} | {r['calls']} |")
traffic_lines += ["", "Errors from historical logs are not proof of current provider outages. Classify connection-test calls separately before calculating real task success rates."]
write("07_Compression_Traffic_Quotas/07.03_Sanitized_Request_Summary.md","\n".join(traffic_lines))
con.close()
print("COUNTS",json.dumps(counts,ensure_ascii=False))
print("KEYS_EXPORTED_ONLY_AS_METADATA",len(keys))
print("COMBOS_EXPORTED",len(combos))
