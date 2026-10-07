"use client";

import { Fragment, useMemo } from "react";

const PY = new Set("import from def return if elif else for while in not and or try except finally with as class pass break continue global lambda None True False raise yield is".split(" "));
const C = new Set("void int float double char bool const static unsigned long short return if else for while do switch case break continue struct class include define true false nullptr uint8_t uint16_t uint32_t int16_t int32_t size_t String byte".split(" "));

type Tok = [cls: string, text: string];

/** A small tokenizer: enough to colour comments, strings, numbers, keywords and calls. */
function tokens(line: string, lang: "python" | "c"): Tok[] {
  const out: Tok[] = [];
  const kw = lang === "python" ? PY : C;
  const re = lang === "python" ? /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d[\d_.xXa-fA-F]*\b)|([A-Za-z_]\w*)(\s*\()?|(\s+|.)/g : /(\/\/.*$|\/\*.*?\*\/|^\s*#\w+.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d[\d_.xXa-fA-F]*\b)|([A-Za-z_]\w*)(\s*\()?|(\s+|.)/g;
  for (const m of line.matchAll(re)) {
    if (m[1]) out.push(["text-[#3f8f3a]", m[1]]);
    else if (m[2]) out.push(["text-[#c0392b]", m[2]]);
    else if (m[3]) out.push(["text-[#1f7fbf]", m[3]]);
    else if (m[4]) {
      out.push([kw.has(m[4]) ? "text-[#a626a4]" : m[5] ? "text-[#2f5fc4]" : "", m[4]]);
      if (m[5]) out.push(["", m[5]]);
    } else out.push(["", m[6]]);
  }
  return out;
}

export function CodeView({ code, language }: { code: string; language: "python" | "c" }) {
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n").map((l) => tokens(l, language)), [code, language]);
  return (
    <pre className="scroll-thin h-full overflow-auto py-4 font-mono text-[12.5px] leading-[1.55]" tabIndex={0} aria-label="Firmware source">
      <code className="grid min-w-max grid-cols-[auto_1fr]">
        {lines.map((toks, i) => (
          <Fragment key={i}>
            <span className="pr-6 pl-5 text-right text-ink-3/70 select-none">{i + 1}</span>
            <span className="pr-6 whitespace-pre">
              {toks.map(([cls, text], j) => (cls ? <span key={j} className={cls}>{text}</span> : text))}
              {"\n"}
            </span>
          </Fragment>
        ))}
      </code>
    </pre>
  );
}
