"use client";

import { useRef, useState, type ReactNode } from "react";
import { PracticePrompt } from "@/modules/practice/ui/practice-prompt";
import type { PromptDocument } from "@/modules/practice/domain/content-v3";
import styles from "./practices.module.css";

/** Only text and an explicit allowlist of marks leave the editor; HTML is never stored. */
function readDocument(root: HTMLElement): PromptDocument {
  const blocks: PromptDocument = [];
  function inline(
    node: Node,
    marks: { bold?: boolean; italic?: boolean; underline?: boolean } = {},
  ): PromptDocument[number]["children"] {
    if (node.nodeType === Node.TEXT_NODE) return [{ text: node.textContent ?? "", ...marks }];
    if (!(node instanceof HTMLElement)) return [];
    if (node.tagName === "BR") return [{ text: "\n", ...marks }];
    const next = {
      ...marks,
      ...(["B", "STRONG"].includes(node.tagName) ? { bold: true } : {}),
      ...(["I", "EM"].includes(node.tagName) ? { italic: true } : {}),
      ...(node.tagName === "U" ? { underline: true } : {}),
    };
    return Array.from(node.childNodes).flatMap((child) => inline(child, next));
  }
  function visit(node: Node) {
    if (
      node instanceof HTMLElement &&
      node.tagName === "DIV" &&
      Array.from(node.children).some((child) => ["P", "DIV", "UL", "OL"].includes(child.tagName))
    ) {
      for (const child of Array.from(node.childNodes)) visit(child);
      return;
    }
    if (node instanceof HTMLElement && ["UL", "OL"].includes(node.tagName)) {
      for (const li of Array.from(node.children))
        blocks.push({ type: node.tagName === "UL" ? "bullet" : "numbered", children: inline(li) });
    } else {
      blocks.push({ type: "paragraph", children: inline(node) });
    }
  }
  for (const node of Array.from(root.childNodes)) visit(node);
  return blocks
    .filter((b) => b.children.length)
    .slice(0, 50)
    .map((b) => ({ ...b, children: b.children.slice(0, 100) }));
}

const TOOLS: { command: string; label: string; glyph: ReactNode }[] = [
  { command: "bold", label: "Negrito", glyph: <strong>B</strong> },
  { command: "italic", label: "Itálico", glyph: <em>I</em> },
  { command: "underline", label: "Sublinhado", glyph: <u>U</u> },
  { command: "insertUnorderedList", label: "Lista com marcadores", glyph: "•" },
  { command: "insertOrderedList", label: "Lista numerada", glyph: "1." },
];

export function PracticePromptEditor({
  text,
  document,
  disabled,
  onChange,
}: {
  text: string;
  document?: PromptDocument | undefined;
  disabled: boolean;
  onChange: (text: string, document: PromptDocument) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [initial] = useState({ text, document });
  const [tooLong, setTooLong] = useState(false);
  function update() {
    if (!ref.current) return;
    const doc = readDocument(ref.current);
    const plain = doc.map((b) => b.children.map((c) => c.text).join("")).join("\n");
    setTooLong(plain.length > 600);
    onChange(plain, doc.length ? doc : [{ type: "paragraph", children: [{ text: "" }] }]);
  }
  function format(command: string) {
    ref.current?.focus();
    window.document.execCommand(command);
    update();
  }
  return (
    <div className={styles.promptEditor}>
      <div className={styles.formatBar} role="toolbar" aria-label="Formatação do enunciado">
        {TOOLS.map(({ command, label, glyph }) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => format(command)}
          >
            {glyph}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label="Enunciado"
        aria-required="true"
        aria-multiline="true"
        aria-invalid={tooLong}
        onInput={update}
        onPaste={(event) => {
          event.preventDefault();
          window.document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
          update();
        }}
      >
        <PracticePrompt text={initial.text} document={initial.document} />
      </div>
      {tooLong && <p role="alert">Use no máximo 600 caracteres no enunciado.</p>}
    </div>
  );
}
