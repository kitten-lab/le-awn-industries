import time, sqlite3, os
from pathlib import Path
yard = Path(r"C:\Builds\_mausoleum\alice-box-exiles\nim-data-forestry\prod\yard_sys\store\yard.db")
bench = Path(r"C:\ALICE_BOX\le-awn-industries\glass-compost\prod\bench_sys\store\bench.db")
print("yard_gb", round(yard.stat().st_size/1e9, 3), "bench_kb", round(bench.stat().st_size/1024,1))
t0=time.perf_counter()
y=sqlite3.connect(f"file:{yard.as_posix()}?mode=ro", uri=True, timeout=30)
y.row_factory=sqlite3.Row
print("yard_connect_ms", round((time.perf_counter()-t0)*1000))
t0=time.perf_counter()
b=sqlite3.connect(f"file:{bench.as_posix()}?mode=ro", uri=True, timeout=30)
print("bench_connect_ms", round((time.perf_counter()-t0)*1000))
# list tables quickly
t0=time.perf_counter()
tabs=[r[0] for r in y.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("yard_tables_ms", round((time.perf_counter()-t0)*1000), "n", len(tabs), tabs[:20])
# try face-like query patterns if tables exist
for q in [
 "SELECT count(*) FROM sqlite_master",
]:
  t0=time.perf_counter();
  try:
    print(q, y.execute(q).fetchone(), "ms", round((time.perf_counter()-t0)*1000))
  except Exception as e:
    print(q, "ERR", e)
# faces table?
for name in tabs:
  if "face" in name.lower() or name in ("messages","leaves","crates"):
    t0=time.perf_counter()
    try:
      n=y.execute(f"SELECT count(*) FROM [{name}]").fetchone()[0]
      print("count", name, n, "ms", round((time.perf_counter()-t0)*1000))
    except Exception as e:
      print("count", name, "ERR", e)
