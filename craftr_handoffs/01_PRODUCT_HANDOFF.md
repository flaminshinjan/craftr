# Craftr — Product Handoff

## One-line vision
Craftr is an AI-native physical product builder: describe what you want to make, Craftr designs the hardware, electronics, enclosure, firmware, and manufacturing package.

## Core positioning
Not "AI CAD" and not "3D printing software."

**Craftr = Lovable/Replit for physical products.**

Long-term thesis: convert human intent into manufacturable physical products.

## User experience
1. User describes an idea in plain English.
2. Craftr converts the idea into a structured ProductSpec.
3. It selects verified hardware blocks.
4. It builds a hardware/electrical graph.
5. It arranges components physically.
6. It generates a 3D-printable enclosure.
7. It generates firmware, wiring, BOM, and assembly instructions.
8. User can modify by intent: "make it thinner," "add a screen," "3-day battery," etc.
9. User can export or order a prototype.

## Core abstraction: Blocks
A Block is not just a component. Each Block contains:
- 3D geometry and dimensions
- mounting points / keep-out zones
- voltage / power requirements
- interfaces and pins
- software driver
- compatibility rules
- thermal constraints
- sourcing / cost data
- manufacturing constraints

Examples:
- ESP32 block
- microphone block
- battery block
- OLED block
- button block
- MagSafe mount block
- moisture sensor block

## MVP scope
Do not support arbitrary hardware.

Start with ~20–30 verified Blocks and off-the-shelf electronics.

V1 output:
- product spec
- block graph
- component placement
- generated enclosure
- STL/STEP
- wiring diagram
- BOM
- firmware
- assembly instructions

No custom PCB required initially.

## Best first demo
**MagSafe voice-note device**

Prompt example:
> Make me a small MagSafe voice-note device with one button, rechargeable battery, microphone, and phone sync.

Second demo:
**Plant / irrigation monitor**

The point of two demos is to prove Craftr is a platform, not a single-product generator.

## Product principles
- Hide engineering complexity by default.
- Let users think in outcomes, not GPIO / KiCad / STEP / STL.
- Prefer constrained, verified building blocks over free-form hallucinated hardware.
- Show tradeoffs clearly: thinner vs battery life, cheaper vs capability, etc.
- Optimize for "idea → physical working object."

## North-star product promise
**Describe it. Build it. Order it.**

## Long-term product
Craftr evolves from:

Prompt → prototype

into:

Prompt → validated product → small-batch manufacturing → mass production.

The long-term abstraction is a **compiler for physical products**.
