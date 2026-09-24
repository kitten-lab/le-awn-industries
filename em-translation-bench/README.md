```
=================================================
  L.E. AWN · EM TRANSLATION BENCH
  CO.LEA-004-EMB · the work, not the toy
=================================================
```

The text stays in the middle. A word or a line opens the rail. The note is yours. The Berean rows are not edited.

The card table remains `emt-bench`, the EM Translation Toy.

### Run

```bat
cd C:\ALICE_BOX\le-awn-industries\em-translation-bench\prod
run-bench.bat
```

Port **43174**. Opens on Genesis 1. Previous and next move through the fifty chapters already read out of the Berean table.

Notes land in `notes/word/` and `notes/line/` as markdown. One pen, called reading.

The base files in `base/` are the downloaded Berean table, Strong’s Hebrew lexicon, and `bench.sqlite` built from them. Rebuild with `python prod/bench_sys/build_base.py` if those downloads are replaced.

Berean Standard Bible and the interlinear tables are Bible Hub, CC BY-SA 4.0. Strong’s Hebrew lexicon is Open Scriptures, public domain.
