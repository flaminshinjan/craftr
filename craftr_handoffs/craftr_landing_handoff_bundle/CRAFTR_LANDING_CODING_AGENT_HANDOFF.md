# Craftr Landing Page — Coding Agent Handoff

Build the Craftr marketing landing page using the supplied reference screenshots and transparent PNG assets. The goal is to reproduce the **design language, spacing, composition, and product storytelling** of the references while implementing a real responsive web page — not a screenshot collage.

## Product
Craftr lets someone describe a physical hardware product, choose real components, design its enclosure, generate/flash firmware, see BOM + pricing, and order the manufactured prototype.

Core message: **Turn ideas into real hardware.**

## Files supplied

### Reference UI sections
Use these as the source of truth for visual direction and section composition:

- `references/01_hero.png`
- `references/02_how_it_works.png`
- `references/03_ai_builder.png`
- `references/04_components.png`
- `references/05_design_3d.png`
- `references/06_firmware.png`
- `references/07_bom_pricing.png`
- `references/08_manufacturing.png`
- `references/09_real_products.png`
- `references/10_final_cta.png`

### Transparent assets
Use these as real image assets in the implementation. Do not redraw them with CSS and do not substitute generic stock images.

Brand:
- `assets/brand_sunflower_logo.png`
- `assets/brand_wordmark.png`

Primary product / scene assets:
- `assets/hero_smart_plant_monitor.png`
- `assets/design_smart_plant_monitor.png`
- `assets/firmware_builder_scene.png`
- `assets/manufacturing_factory_scene.png`

Hardware components:
- `assets/component_esp32.png`
- `assets/component_soil_moisture_sensor.png`
- `assets/component_lipo_battery.png`
- `assets/component_solar_panel.png`
- `assets/component_oled_display.png`
- `assets/component_camera_module.png`
- `assets/component_gps_module.png`
- `assets/component_temperature_sensor.png`

Product family:
- `assets/product_smart_plant_monitor.png`
- `assets/product_pet_tracker.png`
- `assets/product_weather_station.png`
- `assets/product_home_automation.png`

## Overall visual direction

Craftr should feel like a premium product company — calm, minimal, warm, tactile, and slightly playful.

Do NOT make it look like a generic AI SaaS landing page.

Design characteristics:
- warm off-white / cream background rather than pure white
- charcoal/near-black typography
- large, confident sans-serif headlines
- small sunflower/pixel-block brand mark
- restrained green + warm yellow accents
- subtle borders and extremely soft shadows
- generous whitespace
- rounded corners, but avoid excessive pill-shaped UI
- real 3D/block-style objects are the hero visuals
- almost no gradients
- no neon AI aesthetic
- no glassmorphism
- no excessive decorative blobs
- no stock photography

The 3D style should feel like **tiny physical objects made from friendly block-like parts**, not Minecraft branding and not a children's toy site.

## Page structure

### 1. Header + Hero
Match `01_hero.png`.

Header:
- Craftr sunflower + wordmark left
- Build / Components / Pricing / Resources navigation
- Sign in
- black `Get started →` CTA
- sticky header is okay, but keep it quiet

Hero copy:
**turn ideas into real hardware.**

Subcopy:
**Design, program, and manufacture custom devices with AI — from a simple idea to something real.**

CTAs:
- `Start building →`
- `Watch a demo`

Use `hero_smart_plant_monitor.png` as the dominant hero visual. Add small status/data cards around it only where they improve composition.

Below the CTA, show three understated value points:
- AI-powered
- Real components
- Prototype to production

### 2. How it works
Match `02_how_it_works.png`.

Headline:
**from idea to device in a few simple steps.**

Five steps laid out horizontally on desktop and vertically on mobile:
1. Describe
2. Choose components
3. Design enclosure
4. Write firmware
5. Manufacture

Each step should have a small visual or icon. Keep cards spacious and editorial, not dashboard-heavy.

### 3. AI Builder
Match `03_ai_builder.png`.

Split layout:
- left: large headline + explanation + prompt field
- right: product-builder UI mockup built with HTML/CSS, not a flattened image

Headline:
**just describe what you want to build.**

Prompt example:
`a smart plant monitor that measures soil moisture and sends data to my phone.`

Below the prompt add example chips:
- a pet tracker
- a temperature logger
- a smart plant monitor
- a door lock

The builder mockup should show Craftr turning the prompt into a plan: select components, design enclosure, write firmware, review BOM & cost, prepare for manufacturing.

### 4. Real Components
Match `04_components.png`.

Headline:
**real components. endless possibilities.**

Copy should emphasize that the system uses actual sourced hardware, not invented components.

Show a component grid using the transparent component assets. Cards should include concise metadata such as component name/category, with simple add buttons.

Suggested categories:
- Sensors
- Power
- Connectivity
- Displays
- Other

### 5. Design in 3D
Match `05_design_3d.png`.

Headline:
**Design in 3D.**

Use `design_smart_plant_monitor.png` prominently.

Show enclosure controls such as:
- style: Minimal / Rugged / Compact
- material: PLA / ABS / PETG / PC
- color swatches
- dimensions

This section should communicate live customization, not professional CAD complexity.

### 6. Firmware
Match `06_firmware.png`.

Headline:
**write and test firmware.**

Left side:
- Built-in editor
- Real-time logs
- One-click flashing

Right side:
- code editor mockup with believable MicroPython/ESP32 code
- logs panel
- board selector
- `Flash` button

Use `firmware_builder_scene.png` as a supporting visual, not the main UI.

### 7. BOM & Pricing
Match `07_bom_pricing.png`.

Headline:
**instant BOM and pricing.**

Create a clean BOM table with:
- component
- quantity
- unit price
- total

Use INR pricing in the demo and include an `Estimated Total` row.

Explain:
- live component pricing
- full bill of materials
- updates automatically

### 8. Manufacturing
Match `08_manufacturing.png`.

Headline:
**Manufacture with a click.**

Use `manufacturing_factory_scene.png` as the main visual.

Show the process:
Review → Quote → Fabrication → Testing → Shipping

Copy should make it clear Craftr orchestrates manufacturing; the customer should not have to deal with 3D printers or separate vendors.

### 9. Real Products
Match `09_real_products.png`.

Headline:
**real products. endless possibilities.**

Use the four transparent product assets:
- Smart Plant Monitor
- Pet Tracker
- Weather Station
- Home Automation

Cards should feel like a gallery of things users can actually build/remix, not ecommerce products.

### 10. Final CTA + Footer
Match `10_final_cta.png`.

Headline:
**ready to build something real?**

Subcopy:
**Join makers, engineers, and founders building physical products with AI.**

Primary CTA:
`Get started →`

Use a warm, slightly cinematic block-world composition around the CTA, but keep the text area extremely clean.

Footer should include:
- Craftr logo
- Build
- Components
- Pricing
- Resources
- social links
- copyright

## Motion / interaction

Keep motion subtle and premium:
- hero product very slow floating/parallax motion
- component cards lift by only a few pixels on hover
- section visuals gently reveal on scroll
- no large bouncing animations
- no constant glowing effects
- respect `prefers-reduced-motion`

If using 3D/WebGL would make the page fragile, use the supplied transparent renders and tasteful transforms instead. Reliability is more important than forcing WebGL.

## Responsive behavior

Desktop is the primary composition, but mobile must be intentional.

On mobile:
- hero becomes text → product visual
- 5-step row becomes vertical or horizontally scrollable cards
- feature split sections stack cleanly
- component grid becomes 2 columns
- BOM table can horizontally scroll
- preserve generous padding
- avoid tiny text

## Implementation quality

- Reuse the existing project stack and conventions.
- Build reusable section/card/component primitives rather than one giant page component.
- Use semantic HTML.
- Optimize images and prevent layout shift.
- Preserve transparent PNG quality.
- Add sensible alt text.
- No placeholder lorem ipsum.
- Do not reproduce browser chrome from the reference screenshots on the live site.
- Do not hardcode the screenshots themselves as page sections.
- The screenshots are visual references; the site must be native HTML/CSS/JS.

## Final acceptance criteria

The page should immediately communicate:

**idea → components → enclosure → firmware → BOM → manufacturing → real product**

A visitor should understand within ~5 seconds that Craftr lets them turn a prompt into a real manufactured hardware product.

The final implementation should feel quieter and more premium than a typical AI startup landing page, while retaining the playful block/sunflower visual identity.
