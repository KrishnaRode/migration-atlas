---
id: explaining-to-executives
title: Explaining migration trade-offs to executives (CTO, CIO, board)
triggers:
  technologies: []
  roles: []
  keywords: [cto, cio, cdo, cfo, executive, executives, board, leadership, business case, steering committee, roadmap, investment, stakeholders, summary for management, why should we, risk appetite]
match: keywords   # cross-cutting: only fires when the question is about this topic
priority: 8
---

## Lead with outcomes, not technology
Open with the business problem and the measurable outcome: licence/renewal exposure, time-to-insight, regulatory risk, ability to adopt AI, resilience, cost trajectory. Technology names come later and only where they explain a decision. One sentence per point; numbers with ranges and stated assumptions.

## A structure that works (one page or five slides)
1. **Situation**: what exists, what is breaking or expiring (dates), what it costs today.
2. **Options** (usually 3): e.g., *retain and extend*, *targeted migration* (phase by domain), *full replatform*. Include doing nothing honestly.
3. **Trade-offs** for each option: cost range, time to first value, risk level, skills impact, reversibility, lock-in.
4. **Recommendation** with the reasoning and the conditions under which you would change it.
5. **Plan**: phases, first 90 days, decision points, what leaders must provide (owners, budget, people time).
6. **Risks and mitigations**: top 5 only, each with an owner.

## How to frame common trade-offs
- **Speed vs transformation**: lift-and-shift exits contracts quickly but defers value; refactoring delivers value but takes longer. Often the answer is "move fast where the code is simple, modernise where value is highest."
- **Build vs buy**: platform services reduce operational burden at the cost of some lock-in; quantify exit cost rather than arguing ideology.
- **Single vs multi-platform**: simplicity and skills concentration vs flexibility; every extra platform needs a team.
- **Big bang vs phased**: phased delivery shows value earlier and limits blast radius, but extends dual-running cost; show both curves.
- **Cost**: present a TCO with dual-running hump and the decommission date that realises savings. Never promise savings without a decommission plan.

## Risk language executives understand
Translate technical risks into business consequences: "If month-end reconciliation fails, finance close slips" rather than "decimal precision mismatch". Give probability and impact as High/Medium/Low with the mitigation and its cost.

## Organisation and skills impact
Executives care about people: which roles change, what training is required, where partners fill gaps temporarily, and how knowledge transfers to internal teams. Name the operating model (platform team, domain teams, data owners) and the governance forum.

## Sequencing signals they want
- First value in 3–6 months from a visible domain.
- Clear stage gates with go/no-go criteria (reconciliation passed, performance met, users signed off).
- Contract and renewal dates mapped to milestones.

## What to ask before writing
Who is the audience and what decision do they need to make? What is their risk appetite, budget cycle, and existing commitments (cloud agreements, vendor contracts)? What failed before?

## Avoid
- Vendor marketing language, acronym soup, and unexplained product names.
- Single-point estimates presented as certain.
- Hiding the dual-running period or the people cost.
- Declaring a platform "best" without stating criteria.
