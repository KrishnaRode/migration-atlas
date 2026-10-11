---
id: mainframe-modernization
title: Mainframe modernization (COBOL, CICS, VSAM, Db2 z/OS, JCL, IMS)
triggers:
  technologies: [ibm-zos, cobol, cics, vsam, jcl, ims, ibm-db2-zos, ibm-mq, qlik-replicate, striim, control-m]
  roles: [mainframe]
  keywords: [mainframe, cobol, cics, vsam, jcl, ims, z/os, zos, ebcdic, copybook, comp-3, packed decimal, rehost, refactor, strangler, mips]
priority: 6
---

## Pick the strategy per application, not per mainframe
- **Retain + integrate**: keep core transaction processing, expose via APIs/events, offload analytics. Lowest risk; often the right first step.
- **Rehost/replatform**: run COBOL on x86/cloud with emulation or recompilation runtimes (e.g., vendor rehosting platforms, AWS Mainframe Modernization runtime options — verify current offerings). Fast MIPS exit, code stays COBOL.
- **Refactor (automated conversion)**: COBOL → Java/C# via tools. Produces working but often non-idiomatic code; budget for testing and later cleanup.
- **Rewrite/replace**: rebuild or buy (SaaS/package). Highest business value potential, highest risk; only with strong product ownership.
- Rule of thumb: offload data and reporting first (quick wins, low risk), then tackle transactions incrementally.

## Data offload essentials
- **EBCDIC to ASCII/UTF-8**: code page matters (e.g., CP037 vs CP1047 vs national pages); test special characters.
- **Copybooks** define layouts: packed decimal (COMP-3), binary (COMP), zoned decimal with signs, REDEFINES, OCCURS DEPENDING ON. Use proven parsers (Cobrix-style Spark readers, vendor tools) rather than custom code.
- VSAM KSDS/ESDS and IMS hierarchical segments need flattening into relational/lakehouse tables; preserve keys and segment parentage.
- Db2 z/OS: CDC via Db2 log readers (IBM InfoSphere Data Replication, Qlik Replicate, Striim, Precisely — verify current product names) to avoid MIPS-heavy extracts.
- Schedule extracts outside the batch window; extract cost consumes MIPS/MSU and can raise the monthly software bill.

## Strangler fig for transactions
1. Map transactions, programs and data ownership (static analysis tools; call graphs).
2. Put an API facade in front of CICS/IMS transactions (z/OS Connect or integration layer).
3. Move read-only queries to a replicated store first (CDC to cloud database).
4. Move bounded functions one at a time; synchronise data bi-directionally only where unavoidable, and time-box it.
5. Retire mainframe components as traffic drains.

## Batch
JCL job streams with GDGs, sort utilities (DFSORT/Syncsort), checkpoint/restart and return-code logic must move to orchestrators and set-based processing. Batch windows often hide implicit sequencing — capture from the scheduler, not from documentation.

## Testing
Behavioural equivalence: record production inputs/outputs and replay against the new system; compare byte-level or field-level outputs. Decimal arithmetic and rounding differences between COBOL and Java/SQL are the classic defect source.

## What to ask
MIPS/MSU consumption and contract dates, lines of COBOL/PL1/Assembler, CICS vs IMS share, batch vs online split, Db2 vs VSAM vs IMS DB data, number of interfaces, availability of SMEs, and regulatory constraints.

## Red flags
- Big-bang rewrite with a fixed date and no incremental releases.
- Assembler or undocumented vendor utilities ignored in scope.
- SMEs retiring with no knowledge-capture plan.
- Cost case assumes immediate MIPS reduction while mainframe and cloud run in parallel for years.
- Copybook versions not controlled; layouts differ from actual files.
