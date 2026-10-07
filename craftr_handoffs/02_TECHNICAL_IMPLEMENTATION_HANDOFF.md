# Craftr — Technical Implementation Handoff

## Goal
Build a constrained agentic system that converts a user prompt into a working electronic prototype using verified hardware Blocks.

## High-level architecture

User Prompt
↓
Product Agent
↓
ProductSpec
↓
Block Selection + Compatibility Graph
↓
Mechanical Agent / Electronics Agent / Firmware Agent
↓
Validation Agent
↓
Manufacturing Package

## Core services

### 1. Product Agent
Responsibilities:
- extract intended use
- infer constraints
- ask only essential questions
- produce structured ProductSpec

Suggested ProductSpec fields:
- use_case
- dimensions
- target_cost
- power_source
- battery_target
- connectivity
- inputs
- outputs
- environment
- mounting
- enclosure_style
- manufacturing_method

### 2. Block Registry
Each Block should have machine-readable metadata:

```yaml
id: esp32_s3_devkit
category: compute
geometry: esp32_s3.step
physical:
  width_mm: 25
  height_mm: 54
  depth_mm: 10
  mounting_points: []
electrical:
  input_voltage: 5V
  io_voltage: 3.3V
  interfaces: [i2c, spi, uart, i2s]
power:
  typical_ma: 80
software:
  drivers: []
compatibility:
  allow: []
  deny: []
sourcing:
  vendor: "..."
  price_usd: 8
manufacturing:
  clearance_mm: 1.0
```

## 3. Hardware graph
Represent selected Blocks as a graph:
- nodes = Blocks
- edges = electrical/mechanical/software relationships

Examples:
- ESP32 → I2S → microphone
- battery → charger → ESP32
- button → GPIO → ESP32
- MagSafe mount → enclosure rear face

## 4. Mechanical generation
Avoid general-purpose CAD initially.

Use parametric primitives:
- rounded box
- rectangular enclosure
- cylinder
- faceplate

Features:
- cavities
- screw bosses
- snap fits
- ventilation
- button holes
- USB-C cutout
- microphone opening
- display opening

Workflow:
1. import known STEP meshes for Blocks
2. place components
3. generate enclosure around bounding volumes
4. add tolerances / clearances
5. export STEP + STL

Potential implementation paths:
- CadQuery
- OpenSCAD
- FreeCAD scripting
- OCC/OpenCascade-based generation

## 5. Firmware generation
Generate firmware from the Block graph, not from scratch.

Each Block should expose:
- driver
- init function
- code template
- examples

Flow:
Block graph → firmware composition → compile → inspect errors → agent repair → compile again.

## 6. Validation layer
Initially deterministic checks should be more important than AI reasoning.

Check:
- voltage compatibility
- pin conflicts
- bus availability
- estimated current draw
- battery capacity
- enclosure collisions
- minimum wall thickness
- port accessibility
- component clearances
- basic thermal constraints

## 7. Outputs
Generate:
- product.json
- bom.csv
- wiring.json / diagram
- enclosure.step
- enclosure.stl
- firmware source
- assembly.md

## MVP constraints
Support only:
- ESP32-class compute
- Wi-Fi/BLE
- buttons
- LEDs
- OLED
- MEMS mic
- small speaker
- LiPo
- charging board
- temperature / moisture / motion sensors
- MagSafe ring

No custom PCB in V1.

## Future architecture
Later add:
- schematic generation
- PCB layout
- SPICE / power simulation
- thermal simulation
- custom PCB assembly
- DFM validation
- CNC
- injection molding
- vendor quoting
- production orchestration

## Key technical moat
Do not optimize around owning a model.

Own:
- verified Block graph
- compatibility data
- manufacturing feedback
- successful/failed build dataset
- generated-design → real-world-outcome loop

## Core metrics
- successful first-build rate
- human minutes per successful design
- % of designs completed without human engineering intervention
- fabrication failure rate
- firmware compile success rate
