---
vendor: IBM
product: IBM z/OS
title: Mainframe modernization — COBOL, CICS, VSAM, JCL and EBCDIC data
url: https://www.ibm.com/docs/en/zos
doc_type: curated-note
technologies: [ibm-zos, cobol, cics, vsam, jcl, ibm-db2-zos, ims, java]
version: null
---

## Context

Mainframe estates on IBM z/OS typically combine COBOL (and PL/I or Assembler) programs, online transaction processing in CICS or IMS TM, data in VSAM files, Db2 for z/OS and IMS DB, and batch driven by JCL under an enterprise scheduler. Modernisation is usually the highest-risk class of migration because of volume of code, embedded business rules and tight SLAs.

## Strategy options

- **Rehost/replatform**: run recompiled COBOL on emulation or rehosting runtimes on x86/cloud (commercial products from vendors such as Rocket Software/Micro Focus, plus cloud offerings like AWS Mainframe Modernization; check current documentation for supported patterns).
- **Refactor**: automated conversion of COBOL to Java or C#, with data moved to relational databases.
- **Rearchitect/replace**: rebuild as services or buy packages, often incrementally (strangler pattern).
- **Data-first**: keep transactions on the mainframe but replicate data (CDC from Db2/IMS/VSAM via products such as IBM Data Replication or Precisely) to a cloud analytics platform.

## Data considerations

- **EBCDIC encoding**: text uses EBCDIC code pages (for example 037 US, 1140 with euro, 273 German); conversion to ASCII/UTF-8 must use the correct code page, and binary fields must not be converted as text.
- **COBOL copybooks** define record layouts. Watch for `COMP-3` packed decimal, `COMP`/binary, zoned decimal with sign overpunch, implied decimal points (`PIC 9(7)V99`), `REDEFINES` (multiple layouts for the same bytes) and `OCCURS DEPENDING ON` (variable-length arrays).
- **VSAM**: KSDS (keyed), ESDS (entry-sequenced) and RRDS (relative record) datasets; alternate indexes; variable-length records.
- **Collation**: EBCDIC sorts digits after letters, unlike ASCII; sort-dependent logic and merge/match programs can behave differently after conversion.
- **JCL batch**: steps, DD statements, GDGs (generation data groups), return-code-based conditional execution (`COND`, `IF/THEN`), sort utilities (DFSORT/SYNCSORT) and restart/checkpoint procedures all need equivalents.

## Common pitfalls

- Converting files with a generic text converter, corrupting packed decimals.
- Missing undocumented business rules in COBOL paragraphs, copybook REDEFINES and JCL step conditions.
- Underestimating batch-window and online-response SLAs on the target.
- Forgetting interfaces: MQ queues, file transfers (Connect:Direct), and downstream consumers of mainframe extracts.
