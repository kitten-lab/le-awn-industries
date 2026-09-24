from pathlib import Path
import os
# top-level recursive counts code.glass
root=Path(r"C:\ALICE_BOX\my-pocket-things\pocket-go\~hosts\code.glass")
print("=== code.glass top-level ===")
for name in sorted(os.listdir(root)):
  p=root/name
  if p.is_dir():
    n=sum(len(fs) for _,_,fs in os.walk(p))
    d=sum(1 for _,dns,_ in os.walk(p) for __ in dns)
    print(f"{n:4d} files  ~{d:4d} subdirs  {name}")
# tags shell tokens
for host in ["code.tags","help","code.glass"]:
  shell=Path(rf"C:\ALICE_BOX\my-pocket-things\pocket-go\~hosts\{host}\_shell.md")
  print("===", host, "shell exists", shell.exists())
  if shell.exists():
    t=shell.read_text(encoding="utf-8",errors="replace")
    for tok in ["{{tree}}","{{dirtree","{{compost}}","{{codelook}}","{{codesearch}}","{{files}}","{{taglook}}","{{tagsearch}}","{{doors}}","{{navbar"]:
      if tok in t: print(" ", tok)
# how many notes notes_with_chip would scan
hosts_root=Path(r"C:\ALICE_BOX\my-pocket-things\pocket-go\~hosts")
n_md=0
for dp,_,fns in os.walk(hosts_root):
  if "castaways" in dp: continue
  for fn in fns:
    if fn.lower().endswith(".md") or fn.lower().endswith(".chip"):
      n_md+=1
print("approx md+chip under ~hosts", n_md)
# castaways size
cast=Path(r"C:\ALICE_BOX\my-pocket-things\pocket-go\castaways\~hosts")
n2=0
if cast.exists():
  for dp,_,fns in os.walk(cast):
    for fn in fns:
      if fn.lower().endswith((".md",".chip")): n2+=1
print("castaways ~hosts md+chip", n2)
