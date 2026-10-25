import type { PromptDocument } from "@/modules/practice/domain/content-v3";

function MarkedText({ text, bold, italic, underline }: PromptDocument[number]["children"][number]) {
  let content: React.ReactNode = text;
  if (underline) content = <u>{content}</u>;
  if (italic) content = <em>{content}</em>;
  if (bold) content = <strong>{content}</strong>;
  return <>{content}</>;
}

/** Renders bounded prompt text as React nodes. Never interpret prompt content as HTML. */
export function PracticePrompt({
  text,
  document,
}: {
  text: string;
  document?: PromptDocument | undefined;
}) {
  if (!document?.length) {
    return <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>;
  }

  const groups: { type: PromptDocument[number]["type"]; blocks: PromptDocument }[] = [];
  for (const block of document) {
    const last = groups.at(-1);
    if (block.type !== "paragraph" && last?.type === block.type) last.blocks.push(block);
    else groups.push({ type: block.type, blocks: [block] });
  }
  const children = (block: PromptDocument[number]) =>
    block.children.map((child, index) => <MarkedText key={index} {...child} />);
  return (
    <div>
      {groups.map((group, index) =>
        group.type === "paragraph" ? (
          <p key={index}>{children(group.blocks[0]!)}</p>
        ) : group.type === "bullet" ? (
          <ul key={index}>
            {group.blocks.map((block, n) => (
              <li key={n}>{children(block)}</li>
            ))}
          </ul>
        ) : (
          <ol key={index}>
            {group.blocks.map((block, n) => (
              <li key={n}>{children(block)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
