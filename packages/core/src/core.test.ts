import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOCKS, TEMPLATES, compile, composeFirmware, getBlock, nodesFromBlocks, DEFAULT_DESIGN, DEFAULT_SPEC } from "./index";

test("block ids are unique and well formed", () => {
  assert.equal(new Set(BLOCKS.map((b) => b.id)).size, BLOCKS.length);
  for (const b of BLOCKS) {
    assert.ok(b.priceInr > 0, b.id);
    assert.ok(b.size.w > 0 && b.size.d > 0 && b.size.h > 0, b.id);
    if (b.iface === "mcu") assert.ok(b.pinmap, b.id);
  }
});

for (const t of TEMPLATES) {
  test(`proven build compiles clean: ${t.id}`, () => {
    const c = compile(t);
    const errors = c.checks.filter((k) => k.level === "error");
    assert.deepEqual(errors, []);
    assert.ok(c.layout.fits);
    // No MCU pin is handed to two different non-bus signals.
    const seen = new Map<string, string>();
    for (const e of c.edges.filter((e) => e.kind === "digital" || e.kind === "analog")) {
      for (const p of e.pins.filter((p) => p.b.startsWith("GPIO"))) {
        assert.ok(!seen.has(p.b), `${p.b} used by ${seen.get(p.b)} and ${e.from}`);
        seen.set(p.b, e.from);
      }
    }
    // Every part sits inside the cavity.
    const { outer, wall, shape } = c.layout;
    for (const p of c.layout.placements.filter((p) => p.layer !== "external")) {
      assert.ok(Math.abs(p.pos[2]) + p.size[2] / 2 <= outer.d / 2 - wall + 1e-6, `${p.blockId} pokes out front or back`);
      if (shape === "round") {
        const reach = getBlock(p.blockId)!.round ? Math.hypot(p.pos[0], p.pos[1]) + p.size[0] / 2 : Math.hypot(Math.abs(p.pos[0]) + p.size[0] / 2, Math.abs(p.pos[1]) + p.size[1] / 2);
        assert.ok(reach <= outer.w / 2 - wall + 1e-6, `${p.blockId} pokes out of the round wall`);
      } else {
        (["w", "h"] as const).forEach((axis, i) => assert.ok(Math.abs(p.pos[i]) + p.size[i] / 2 <= outer[axis] / 2 - wall + 1e-6, `${p.blockId} pokes out on ${axis}`));
      }
    }
    // No two parts in the same layer overlap.
    const inside = c.layout.placements.filter((p) => p.layer !== "external");
    for (const a of inside) for (const b of inside) if (a !== b && a.layer === b.layer) assert.ok(Math.abs(a.pos[0] - b.pos[0]) >= (a.size[0] + b.size[0]) / 2 - 1e-6 || Math.abs(a.pos[1] - b.pos[1]) >= (a.size[1] + b.size[1]) / 2 - 1e-6, `${a.blockId} overlaps ${b.blockId}`);
    if (t.design.shape === "card") {
      assert.ok(c.layout.pocket, "card shape with pocketCards should get a pocket");
      // Nothing front-mounted may sit under the pocket.
      const bottom = c.layout.pocket.y - c.layout.pocket.h / 2;
      for (const p of c.layout.placements.filter((p) => p.layer === "front")) assert.ok(p.pos[1] + p.size[1] / 2 <= bottom + 1e-6, `${p.blockId} is under the card pocket`);
    }
    const fw = composeFirmware(t);
    assert.ok(fw.files[0].content.includes("while True:"));
    assert.ok(!/\{[A-Z]+\}/.test(fw.files[0].content), "unfilled pin placeholder");
    assert.ok(c.pricing.unitInr > c.pricing.bomInr);
  });
}

test("catches real problems", () => {
  const run = (ids: string[], design = DEFAULT_DESIGN) => compile({ nodes: nodesFromBlocks(ids), design, spec: DEFAULT_SPEC }).checks.filter((c) => c.level === "error").map((c) => c.id);
  assert.deepEqual(run(["dht22"]), ["mcu"]);
  assert.ok(run(["esp32_devkit", "lipo_1000"]).includes("charger"));
  assert.ok(run(["esp32_devkit", "sht31", "sht31"]).some((id) => id.startsWith("i2c-")));
  assert.ok(run(["xiao_esp32s3", "rotary_encoder", "rotary_encoder", "button"]).includes("pins"));
  assert.ok(run(["esp32_devkit", "oled_096"], { ...DEFAULT_DESIGN, auto: false, width: 20, height: 20, depth: 10 }).includes("fit"));
  assert.ok(getBlock("esp32_devkit"));
});
