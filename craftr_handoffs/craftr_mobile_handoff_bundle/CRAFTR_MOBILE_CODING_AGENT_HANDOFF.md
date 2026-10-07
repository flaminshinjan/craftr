# Craftr Mobile Landing Page — Coding Agent Handoff

## Goal
Build the mobile version of the Craftr marketing site using the supplied mobile reference screens and the exact transparent PNG assets in `assets/`.

Craftr is an AI-native hardware builder: users describe a device, choose real components, customize the enclosure, generate firmware, review BOM/cost, and order manufacturing.

The mobile site must feel like the same premium product as desktop — not a separate redesign.

## Files

### Mobile reference screens
- `references/01_mobile_hero.png`
- `references/02_mobile_ai_builder.png`
- `references/03_mobile_components.png`
- `references/04_mobile_design.png`
- `references/05_mobile_firmware.png`
- `references/06_mobile_bom_pricing.png`
- `references/07_mobile_manufacturing.png`
- `references/08_mobile_products.png`
- `references/09_mobile_final_cta.png`

### Transparent assets
Use files from `assets/` directly. Important assets include:
- `brand_sunflower_logo.png`
- `brand_wordmark.png`
- `hero_smart_plant_monitor.png`
- `design_smart_plant_monitor.png`
- `product_smart_plant_monitor.png`
- `product_pet_tracker.png`
- `product_weather_station.png`
- `product_home_automation.png`
- `component_esp32.png`
- `component_soil_moisture_sensor.png`
- `component_lipo_battery.png`
- `component_solar_panel.png`
- `component_oled_display.png`
- `component_camera_module.png`
- `component_gps_module.png`
- `component_temperature_sensor.png`
- `firmware_builder_scene.png`
- `manufacturing_factory_scene.png`

Do not screenshot or crop the reference images into the implementation. Recreate the layout in real HTML/CSS and use the transparent assets as actual image elements.

## Design language
- Warm off-white / cream canvas.
- Near-black typography.
- Muted gray secondary text.
- Soft green and warm amber accents.
- Very subtle 1px warm borders.
- Rounded corners, generally 20–28px on large surfaces.
- Soft, restrained shadows. Avoid glassmorphism, heavy gradients, neon, or excessive blur.
- Large bold grotesk/sans headlines with tight line-height.
- Spacious, editorial composition.
- 3D voxel/block assets should feel tactile and playful while the UI remains professional.
- Keep visual density low. One primary idea per screen.

## Mobile breakpoint strategy
Design mobile-first around 390–430px CSS width.

Recommended breakpoints:
- Mobile: `< 768px`
- Tablet: `768–1023px`
- Desktop: `>= 1024px`

Mobile page gutters: 20–24px.
Section vertical spacing: 88–120px depending on content.
Never scale the desktop layout down mechanically. Recompose it.

## Header
On mobile:
- Left: sunflower icon + Craftr wordmark.
- Right: hamburger button.
- Sticky or static is acceptable, but if sticky use a clean opaque/90% cream background with a very subtle border.
- Mobile menu should open as a simple full-width sheet containing Product, Components, Pricing, Docs/Resources, Sign in, and Get started.

## Section order

### 1. Hero
Reference: `01_mobile_hero.png`

Content:
- Craftr brand header.
- Headline: `from idea to real device.`
- Supporting copy: `Design, simulate, and manufacture custom hardware with the help of AI.`
- Primary CTA: `Start building`
- Secondary CTA: `Watch demo`
- Hero smart plant monitor asset with small telemetry cards for soil moisture, light, and temperature.
- Three compact trust/value items near the bottom: AI guided builder, Real components, Manufacturing ready.

Mobile behavior:
- Headline first, then CTAs, then hero visual.
- Do not place the hero product beside the copy on mobile.
- Telemetry cards can partially overlap the product scene.

### 2. AI Builder
Reference: `02_mobile_ai_builder.png`

Content:
- Eyebrow: `AI BUILDER`
- Headline: `just describe what you want to build.`
- Supporting copy.
- Prompt field with example smart plant monitor request.
- Four mini-step cards: Describe / Design / Code / Build.
- Product visual + generated-plan checklist.

Interaction:
- Prompt field should be editable.
- Arrow button can route to `/build` or current builder entry route.
- Use real cards and lists, not flattened imagery.

### 3. Components
Reference: `03_mobile_components.png`

Content:
- Eyebrow: `COMPONENTS`
- Headline: `real components. endless possibilities.`
- Search field.
- Horizontally scrollable category chips.
- 2-column grid of component cards on ~390px width.
- Each card uses the supplied transparent component asset.

Interaction:
- Chips scroll horizontally without wrapping.
- Cards can have subtle hover/tap feedback.
- `+` buttons should be accessible touch targets of at least 44px.

### 4. 3D Design
Reference: `04_mobile_design.png`

Content:
- Eyebrow: `DESIGN`
- Headline: `design it your way.`
- Tabs: Enclosure / 3D Model / Exploded View.
- Large product visualization.
- Controls below: style, material, color, dimensions.

Mobile behavior:
- Product render appears before the detailed controls or between tabs and controls.
- Controls use compact cards/grids.
- Avoid horizontal overflow except for tab/chip rails.

### 5. Firmware
Reference: `05_mobile_firmware.png`

Content:
- Eyebrow: `FIRMWARE`
- Headline: `write and test firmware.`
- Code editor card with language/device selector and Flash button.
- Logs card.
- Product asset as supporting visual.
- Three feature points: browser editor / one-click flash / live output.

Implementation notes:
- Use a styled code block or actual lightweight editor component.
- Syntax highlighting can be CSS/Prism/Shiki; do not use a static screenshot of code.

### 6. BOM & Cost
Reference: `06_mobile_bom_pricing.png`

Content:
- Eyebrow: `BOM & COST`
- Headline: `instant BOM and pricing.`
- Small 3D arrangement of core parts.
- Mobile-friendly bill of materials table/card list.
- Currency selector.
- Estimated total.

Mobile behavior:
- If a semantic table becomes too narrow, switch each row into a compact grid rather than allowing unreadable horizontal scrolling.

### 7. Manufacturing
Reference: `07_mobile_manufacturing.png`

Content:
- Eyebrow: `MANUFACTURING`
- Headline: `go from prototype to product.`
- Process rail: Review → Quote → Fabrication → Assembly → Testing → Shipping.
- Manufacturing factory scene.
- CTA: `Get manufacturing quote`
- Feature row: Instant quotes / Global sourcing / Quality tested.

Mobile behavior:
- Process rail can horizontally scroll or wrap into a stepped timeline.
- Manufacturing illustration should be large and central.

### 8. Proven Products
Reference: `08_mobile_products.png`

Content:
- Eyebrow: `PRODUCTS`
- Headline: `real products. endless possibilities.`
- Product cards for Smart Plant Monitor, Pet Tracker, Weather Station, Home Automation Hub.
- Each card uses the supplied individual PNG asset and includes short copy + prototype price + arrow CTA.

Mobile behavior:
- One product card per row.
- Keep product asset left/top and information cleanly aligned.

### 9. Final CTA / Footer
Reference: `09_mobile_final_cta.png`

Content:
- Eyebrow: `CTA` or omit eyebrow in implementation if cleaner.
- Headline: `ready to build your next device?`
- Supporting copy.
- `Get started` CTA.
- Smart plant monitor and sunflower/block assets.
- Footer brand + Product / Components / Pricing / Docs.

## Copy tone
Short, confident, concrete. Avoid AI buzzword soup.
Preferred phrases:
- `from idea to real device.`
- `real components. endless possibilities.`
- `design it your way.`
- `write and test firmware.`
- `instant BOM and pricing.`
- `go from prototype to product.`

## Responsive behavior
Desktop references already exist separately. The implementation should use one responsive component system rather than maintaining separate mobile/desktop pages.

Important transformations:
- 2-column desktop hero → stacked mobile hero.
- Wide feature split → heading then visual then controls.
- Multi-column component/product grids → 2-column or 1-column.
- Dense desktop tables → compact mobile rows.
- Horizontal process diagrams → scrollable/wrapped timeline.
- Desktop nav → hamburger menu.

## Motion
Keep motion subtle:
- Hero product: gentle float of 4–8px.
- Tiny blocks: very slow drift/parallax.
- Cards: 2–4px lift on desktop hover; tap state on mobile.
- Section reveals: 250–450ms fade + translateY 8–16px.
- Respect `prefers-reduced-motion`.

No noisy particle fields or endless animation loops.

## Technical implementation
Use the existing project stack if one exists. If starting fresh, prefer:
- Next.js + TypeScript
- Tailwind CSS or well-structured CSS modules
- `next/image` for raster assets
- Framer Motion only where motion clearly improves the experience
- Lucide icons or an equivalent restrained icon set

Implementation requirements:
- Semantic HTML.
- Accessible buttons/links.
- Good focus states.
- Mobile tap targets >= 44px.
- No CLS from images: reserve dimensions/aspect ratios.
- Optimize PNGs/WebP/AVIF as appropriate, but retain supplied PNGs as source assets.
- Lighthouse-friendly loading and no huge JS bundle for decorative effects.

## Critical instruction
Treat the reference images as visual direction, not as bitmap content to embed. Rebuild every UI surface responsively in code. Use the supplied transparent assets for the 3D product/component/factory imagery so the page remains sharp and adaptable.

## Acceptance checklist
- [ ] Mobile layout closely follows all 9 reference screens.
- [ ] Same visual language as desktop Craftr landing page.
- [ ] Existing transparent assets are reused consistently.
- [ ] Header collapses cleanly to hamburger.
- [ ] No horizontal page overflow at 320, 375, 390, 430px.
- [ ] Text remains readable without shrinking below sensible sizes.
- [ ] Component/product cards are responsive and tappable.
- [ ] BOM, firmware, and process sections are usable on mobile, not merely decorative screenshots.
- [ ] Main CTA appears early and again near the footer.
- [ ] Lighthouse mobile performance target: >= 90 where practical.
