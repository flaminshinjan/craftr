import { resolveNodes, wire } from "./wiring";
import type { Firmware, ProductSpec, ProjectNode } from "./types";

const fill = (line: string, pins: Record<string, string>) => line.replace(/\{([A-Z_+-]+)\}/g, (_, k) => (pins[k] ?? "0").replace("GPIO", ""));

/**
 * Builds MicroPython firmware from each block's verified driver snippet and the assigned pins.
 * This is the baseline that always works offline; the AI layer rewrites it into product behaviour.
 */
export function composeFirmware(input: { name: string; description: string; nodes: ProjectNode[]; spec: ProductSpec }): Firmware {
  const { name, description, nodes, spec } = input;
  const w = wire(nodes);
  const parts = resolveNodes(nodes).filter((p) => p.block.driver);
  const seen = new Set<string>();
  const drivers = parts.filter((p) => (seen.has(p.block.id) ? false : (seen.add(p.block.id), true)));
  const wifi = spec.connectivity.some((c) => /wi-?fi/i.test(c));
  const mcu = w.mcu?.block;
  const usesI2c = drivers.some((p) => p.block.iface === "i2c");

  const out: string[] = [];
  const push = (...l: string[]) => out.push(...l);
  push(`# ${name} - built with Craftr`, ...wrap(description).map((l) => `# ${l}`), `# Board: ${mcu?.name ?? "ESP32"} (MicroPython)`, "");

  const imports = new Set(["import machine", "import time"]);
  if (wifi) ["import network", "import urequests", "import ujson"].forEach((i) => imports.add(i));
  drivers.forEach((p) => p.block.driver!.imports?.forEach((i) => imports.add(i)));
  push(...imports, "");

  push("# Pin configuration (assigned by Craftr, matches the wiring diagram)");
  for (const p of drivers) {
    const pins = w.pinmap[p.node.id] ?? {};
    push(`#   ${p.block.name}: ${Object.entries(pins).map(([k, v]) => `${k} -> ${v}`).join(", ") || "power only"}`);
  }
  push("");

  if (wifi) push('WIFI_SSID = "your-wifi"', 'WIFI_PASSWORD = "your-password"', 'API_URL = "https://example.com/ingest"  # where readings are sent', `DEVICE_ID = "${slug(name)}-001"`, "");
  if (usesI2c && mcu?.pinmap) push(`i2c = machine.I2C(0, sda=machine.Pin(${mcu.pinmap.i2c.sda}), scl=machine.Pin(${mcu.pinmap.i2c.scl}))`, "");

  for (const p of drivers) {
    const d = p.block.driver!;
    const pins = w.pinmap[p.node.id] ?? {};
    if (d.setup.length) push(`# ${p.block.name}`, ...d.setup.map((l) => fill(l, pins)), "");
  }

  const reads: { fn: string; fields: string[] }[] = [];
  const names = new Set<string>();
  const unique = (n: string) => {
    let c = n;
    for (let i = 2; names.has(c); i++) c = `${n}_${i}`;
    names.add(c);
    return c;
  };
  for (const p of drivers) {
    const d = p.block.driver!;
    const pins = w.pinmap[p.node.id] ?? {};
    if (d.read) {
      const fn = unique(d.read.name);
      reads.push({ fn, fields: d.read.fields });
      push(`def ${fn}():`, ...d.read.body.map((l) => `    ${fill(l, pins)}`), "");
    }
    if (d.act) push(`def ${unique(d.act.name)}(value):`, ...d.act.body.map((l) => `    ${fill(l, pins)}`), "");
  }

  if (wifi) {
    push(
      "def connect_wifi():",
      "    wlan = network.WLAN(network.STA_IF)",
      "    wlan.active(True)",
      "    if not wlan.isconnected():",
      "        wlan.connect(WIFI_SSID, WIFI_PASSWORD)",
      "        for _ in range(40):",
      "            if wlan.isconnected():",
      "                break",
      "            time.sleep_ms(250)",
      "    return wlan.isconnected()",
      "",
      "def send(payload):",
      "    try:",
      '        r = urequests.post(API_URL, data=ujson.dumps(payload), headers={"Content-Type": "application/json"})',
      "        r.close()",
      "        return True",
      "    except Exception as e:",
      '        print("Send failed:", e)',
      "        return False",
      "",
    );
  }

  const audio = reads.filter((r) => r.fields.includes("audio"));
  const sensors = reads.filter((r) => !r.fields.includes("audio"));
  push("def read_all():", "    data = {}");
  for (const r of sensors) {
    if (r.fields.length === 1) push(`    data["${r.fields[0]}"] = ${r.fn}()`);
    else push(`    ${r.fields.join(", ")} = ${r.fn}()`, ...r.fields.map((f) => `    data["${f}"] = ${f}`));
  }
  push("    return data", "");

  push("# Main loop");
  if (wifi) push("online = connect_wifi()", 'print("Wi-Fi:", "connected" if online else "offline")');
  const display = names.has("show");
  push("while True:", "    data = read_all()", '    print(data)');
  if (display) push('    show("\\n".join("%s: %s" % kv for kv in data.items()))');
  if (audio.length) push(`    if data.get("pressed"):`, `        chunk = ${audio[0].fn}()  # capture audio while the button is held`, '        print("recorded", len(chunk), "bytes")');
  if (wifi) push('    if online:', '        send(dict(data, device_id=DEVICE_ID))');
  if (spec.duty === "periodic") push('    print("Sleeping for 5 minutes")', "    machine.deepsleep(300 * 1000)");
  else if (spec.duty === "event_driven") push("    time.sleep_ms(50)");
  else push("    time.sleep(1)");

  return { language: "micropython", files: [{ name: "main.py", content: out.join("\n") + "\n" }], source: "template", generatedAt: new Date().toISOString() };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "device";
function wrap(s: string, n = 76): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of s.split(/\s+/).filter(Boolean)) {
    if ((cur + " " + word).trim().length > n) {
      lines.push(cur);
      cur = word;
    } else cur = (cur + " " + word).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
