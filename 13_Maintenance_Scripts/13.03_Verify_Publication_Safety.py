#!/usr/bin/env python3
"""Basic offline validation: numbering, required files, accidental secrets and private path leakage.
Does not print matching text or credentials. Professional secret scanning still required.
"""
from __future__ import annotations
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
required=[
  "README.md", ".gitignore",
  "00_Start_Here/00.01_Scope_and_Ground_Rules.md",
  "01_System_Architecture/01.01_Service_Topology.md",
  "02_Runtime_And_Settings/02.04_Sanitized_Config_Snapshot.json",
  "03_Model_Routing_And_Combos/03.02_Seven_Saved_Combos.md",
  "04_API_Keys_And_Clients/04.02_Client_Key_Permissions.md",
  "05_Integrations/05.01_Antigravity_Desktop_And_IDE.md",
  "06_Model_Inventory_Dashboard/06.01_Companion_Dashboard.md",
  "07_Compression_Traffic_Quotas/07.01_Compression_Policy.md",
  "08_Security_Backup_Recovery/08.02_Secrets_and_GitHub_Publication.md",
  "09_Provider_Research/09.01_Connected_and_Potential_Providers.md",
  "10_Testing_And_Quality/10.02_Stratum_Downloader_Quality_Case.md",
  "11_Roadmap_and_Change_Log/11.04_Chronological_Change_Log.md",
  "12_Reusable_Templates/12.01_New_Client_Onboarding_Checklist.md",
  "13_Maintenance_Scripts/13.02_Refresh_Sanitized_Snapshot.py",
]
violations=[]
for rel in required:
 if not (ROOT/rel).is_file():
  violations.append("Missing mandatory "+rel)

allowed={"README.md",".gitignore"}
serial_folder=re.compile(r"^[0-9]{2}_[A-Za-z0-9_]+$")
serial_filename=re.compile(r"^[0-9]{2}\.[0-9]{2}_[A-Za-z0-9_]+(?:\.local)?\.(?:md|json|py|js|mjs|html)$")
token_like=re.compile(r"(?i)(?<![A-Za-z0-9])(?:sk-|or-v1-|ghp_|hf_)[A-Za-z0-9_-]{18,}")
email_like=re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
machine_path=re.compile(r"(?i)(?:C:\\Users\\[^\\\s]+|E:\\Master Synced Dir\\)")
risk_keys=re.compile(r"(?i)^\s*(?:OMNIROUTE_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|STORAGE_ENCRYPTION_KEY)\s*=\s*\S{8,}",re.MULTILINE)
private_files=0
public_files=0
for file in ROOT.rglob("*"):
 if not file.is_file():
  continue
 rel=file.relative_to(ROOT)
 if "__pycache__" in rel.parts or file.suffix==".pyc":
  continue
 if len(rel.parts)==1:
  if file.name not in allowed:
   violations.append("Unexpected root file "+rel.as_posix())
 elif not serial_folder.fullmatch(rel.parts[0]):
  violations.append("Unnumbered folder "+rel.parts[0])
 elif len(rel.parts)!=2:
  violations.append("Unexpected nesting depth "+rel.as_posix())
 elif not serial_filename.fullmatch(file.name):
  violations.append("Unnumbered file "+rel.as_posix())
 elif file.name.split(".")[0] != rel.parts[0][:2]:
  violations.append("File serial prefix mismatch "+rel.as_posix())
 if file.name.endswith(".local.md") or file.name.endswith(".local.json"):
  private_files+=1
  continue
 public_files+=1
 if file.suffix not in {".md",".py",".json",".js",".mjs",".html"} and file.name not in {".gitignore"}:
  violations.append("Unexpected publication file type "+rel.as_posix())
 if file.name==".gitignore":
  continue
 try:
  text=file.read_text(encoding="utf-8")
 except UnicodeDecodeError:
  violations.append("Nontext file "+rel.as_posix())
  continue
 for label,pat in (("possible credential",token_like),("email address",email_like),
                   ("absolute personal machine path",machine_path),("credential assignment",risk_keys)):
  if pat.search(text):
   violations.append(label+" in "+rel.as_posix())
print("VAULT_CHECK",("PASS" if not violations else "FAIL"))
print("PUBLIC_REVIEWABLE_FILES",public_files)
print("PRIVATE_IGNORED_LOCAL_FILES",private_files)
print("REQUIRED_DOCS",len(required))
print("WARNINGS",len(violations))
for warning in violations[:40]:
 print("WARNING",warning)
if not violations:
 print("Reminder: check staged changes and Git history with a professional secret scanner before publishing.")
sys.exit(0 if not violations else 1)
