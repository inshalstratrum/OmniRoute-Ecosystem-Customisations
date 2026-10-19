#!/usr/bin/env python3
"""Generate public Markdown navigation for numbered OmniRoute documentation; omit private .local files."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
output = root / "00_Start_Here" / "00.04_Vault_File_Index.md"
lines=[
 "# 00.04 Vault file index",
 "",
 "Every public documentation file is linked here in serialized folder/file order.",
 "Machine-specific *.local.md entries, database files and secrets are intentionally excluded.",
 "",
 "- [Main README](../README.md)",
 "",
]
total=0
for folder in sorted(root.iterdir()):
 if not folder.is_dir() or not re.match(r"^\d{2}_",folder.name):
  continue
 lines += ["## "+folder.name.replace("_"," "),""]
 for file in sorted(folder.iterdir()):
  if not file.is_file() or file.suffix not in {".md",".py",".json",".html",".js",".mjs"}:
   continue
  if ".local." in file.name or file.name.startswith("."):
   continue
  if "__pycache__" in file.parts or file.name.endswith(".pyc"):
   continue
  if file == output:
   title="This complete navigation index"
  elif file.suffix==".md":
   try:
    titles=[line.strip().lstrip("#").strip() for line in file.read_text(encoding="utf-8").splitlines() if line.startswith("# ")]
    title=titles[0] if titles else file.stem
   except Exception:
    title=file.stem
  else:
   title=file.stem.replace("_"," ")
  rel="../"+folder.name+"/"+file.name
  title=title.replace("|"," / ").replace("[","(").replace("]",")")
  lines.append("- ["+file.name+"]("+rel+") — "+title)
  total+=1
 lines.append("")
lines += [f"**Indexed public documents/scripts:** {total}", "",
          "Refresh after adding, renaming or removing vault files:",
          "python 13_Maintenance_Scripts/13.04_Rebuild_Document_Index.py", ""]
output.write_text("\n".join(lines),encoding="utf-8",newline="\n")
print("UPDATED",output.relative_to(root).as_posix())
print("INDEXED_PUBLIC_FILES",total)
