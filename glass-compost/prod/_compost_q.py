import time, sqlite3
from pathlib import Path
yard = Path(r"C:\Builds\_mausoleum\alice-box-exiles\nim-data-forestry\prod\yard_sys\store\yard.db")
bench = Path(r"C:\ALICE_BOX\le-awn-industries\glass-compost\prod\bench_sys\store\bench.db")
y=sqlite3.connect(f"file:{yard.as_posix()}?mode=ro", uri=True); y.row_factory=sqlite3.Row
b=sqlite3.connect(f"file:{bench.as_posix()}?mode=ro", uri=True); b.row_factory=sqlite3.Row
# indexes
print("YARD INDEXES")
for r in y.execute("SELECT name,tbl_name,sql FROM sqlite_master WHERE type='index'").fetchall():
  print(r[0], r[1], (r[2] or "")[:120])
print("BENCH INDEXES")
for r in b.execute("SELECT name,tbl_name,sql FROM sqlite_master WHERE type='index'").fetchall():
  print(r[0], r[1], (r[2] or "")[:120])
# simulate compost leaf path for OT-008.T01.B002.L03 style
# first find a face
face=y.execute("SELECT face_id, testament, face_serial, msg_count FROM faces LIMIT 3").fetchall()
print("sample faces", [dict(f) for f in face])
# try OT-008
row=y.execute("SELECT face_id, testament, face_serial, msg_count, bag_code FROM faces WHERE face_serial=8 AND UPPER(COALESCE(testament,''))='OT' LIMIT 1").fetchone()
print("OT-008 face", dict(row) if row else None)
if row:
  fid=row["face_id"]
  for label,q,args in [
    ("msg", "SELECT tags_json FROM messages WHERE face_id=? AND seq=?", (fid,2)),
    ("leaf_y", "SELECT tags_json FROM leaves WHERE face_id=? AND ix=? AND parent_chip=?", (fid,3,f"{fid}.2")),
    ("span", "SELECT MIN(create_time)a, MAX(create_time)b FROM messages WHERE face_id=?", (fid,)),
  ]:
    t0=time.perf_counter()
    try:
      r=y.execute(q,args).fetchone()
      print(label, "ms", round((time.perf_counter()-t0)*1000), "row", bool(r))
    except Exception as e:
      print(label, "ERR", e, "ms", round((time.perf_counter()-t0)*1000))
  t0=time.perf_counter()
  try:
    r=b.execute("SELECT title, note, tags_json FROM msg_leaves WHERE face_id=? AND seq=? AND leaf_n=?", (fid,2,3)).fetchone()
    print("bench leaf ms", round((time.perf_counter()-t0)*1000), bool(r))
  except Exception as e:
    print("bench leaf ERR", e)
