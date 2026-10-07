# Craftr — Planning Handoff

## Objective
Reach a real, repeatable "prompt → working physical prototype" loop before expanding the platform.

## Phase 0 — Define the sandbox
Time: immediate

Choose:
- 20–30 supported Blocks
- ESP32-class compute only
- 3D-printed enclosures
- no custom PCB
- 2–3 enclosure primitives
- 2 flagship demo products

Deliverable:
A fixed technical universe Craftr can reliably reason inside.

## Phase 1 — ProductSpec + Block graph
Build:
- prompt parser
- structured ProductSpec
- Block registry
- compatibility rules
- component selection

Success condition:
"Make me a plant monitor" produces a valid hardware architecture.

## Phase 2 — Mechanical generation
Build:
- component placement
- enclosure shell
- openings / cutouts
- mounting points
- basic collision checks
- STEP/STL export

Success condition:
Generated enclosure can actually fit the selected components.

## Phase 3 — Firmware + wiring
Build:
- wiring graph
- generated firmware
- automatic compile loop
- basic runtime tests

Success condition:
Generated electronics stack turns on and performs intended function.

## Phase 4 — Fabrication loop
Use external 3D-printing vendors initially.

Flow:
Craftr design → vendor print → assemble → test → feed failures back into rules.

Buy a printer only when vendor turnaround becomes a major iteration bottleneck.

## Phase 5 — First real users
Give Craftr to 10–20 users.

Ask only:
> What small electronic object would you make if hardware were easy?

Measure:
- ideas submitted
- completed designs
- failed designs
- orders
- willingness to pay

## 3–6 month roadmap
- 50–100 Blocks
- better placement
- stronger validation
- simple ordering
- multiple print vendors
- project persistence
- revisions / natural-language edits

## 6–12 month roadmap
- 200–500 Blocks
- PCB generation experiments
- electrical simulation
- better mechanical validation
- small-batch ordering
- team collaboration
- creator publishing

## 1–2 year roadmap
- custom PCB / PCBA
- CNC
- production DFM
- marketplace
- vendor routing
- small-batch manufacturing
- enterprise workflows

## Long-term roadmap
Craftr should progressively support:
3D printing → PCB → CNC → sheet metal → injection molding → mass production.

## Metrics to track from day one
1. successful first-build rate
2. human minutes per successful design
3. autonomous completion rate
4. time from prompt to manufacturable package
5. time from prompt to physical prototype
6. repeat usage
7. fabrication conversion rate
8. contribution margin on manufactured orders

## Budget mindset
For early validation, aim to prove demand with roughly ₹1–2L rather than raising first.

Spend on:
- electronics
- prints
- shipping
- API / infra
- occasional expert review

Avoid:
- office
- factory equipment
- huge inventory
- unnecessary hires
- mass component catalog before validation
