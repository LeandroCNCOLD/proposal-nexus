// Parser leve de HTML (TipTap) para React-PDF.
// Suporta: <p>, <br>, <strong>/<b>, <em>/<i>, <u>, <s>, <ul>, <ol>, <li>, <h1>-<h3>.
// Renderiza com Text/View do @react-pdf/renderer preservando inline styles.
import { Text, View } from "@react-pdf/renderer";
import type { PdfStyles } from "./styles";

type InlineMarks = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

interface InlineNode {
  text: string;
  marks: InlineMarks;
}

interface BlockNode {
  type: "p" | "ul" | "ol" | "h1" | "h2" | "h3";
  children: InlineNode[][];
  // For lists: each child item is an array of inline nodes (one item).
  // For p/h: a single item array containing inline runs.
}

const VOID_BR = /<\s*br\s*\/?>/gi;
const ENTITIES: Array<[RegExp, string]> = [
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&lt;/gi, "<"],
  [/&gt;/gi, ">"],
  [/&quot;/gi, '"'],
  [/&#39;/gi, "'"],
];

function decode(s: string): string {
  let out = s;
  for (const [re, rep] of ENTITIES) out = out.replace(re, rep);
  return out;
}

// Extrai inline nodes de um trecho HTML (sem tags de bloco).
function parseInline(html: string): InlineNode[] {
  const out: InlineNode[] = [];
  // Substitui <br> por quebra de linha real
  const normalized = html.replace(VOID_BR, "\n");

  // Tokenize: tags de marca e texto.
  const re = /<\/?(strong|b|em|i|u|s|del)\s*>|([^<]+)/gi;
  const stack: InlineMarks = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const tag = m[1]?.toLowerCase();
    const text = m[2];
    if (tag) {
      const isClose = m[0].startsWith("</");
      const mark =
        tag === "strong" || tag === "b"
          ? "bold"
          : tag === "em" || tag === "i"
            ? "italic"
            : tag === "u"
              ? "underline"
              : "strike";
      stack[mark] = !isClose;
    } else if (text) {
      const decoded = decode(text);
      if (decoded.length > 0) {
        out.push({ text: decoded, marks: { ...stack } });
      }
    }
  }
  return out;
}

// Extrai blocos (p, ul, ol, h1-3) do HTML.
export function parseRichHtml(html: string | null | undefined): BlockNode[] {
  if (!html) return [];
  const blocks: BlockNode[] = [];
  // Regex de blocos top-level.
  const blockRe =
    /<(p|ul|ol|h1|h2|h3)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let foundAny = false;
  while ((match = blockRe.exec(html)) !== null) {
    foundAny = true;
    // Texto solto entre blocos vira parágrafo
    const before = html.slice(lastIndex, match.index).trim();
    if (before && before.replace(/<[^>]+>/g, "").trim().length > 0) {
      const inline = parseInline(before);
      if (inline.length > 0) blocks.push({ type: "p", children: [inline] });
    }
    const tag = match[1].toLowerCase() as BlockNode["type"];
    const inner = match[2];
    if (tag === "ul" || tag === "ol") {
      const itemRe = /<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi;
      const items: InlineNode[][] = [];
      let im: RegExpExecArray | null;
      while ((im = itemRe.exec(inner)) !== null) {
        items.push(parseInline(im[1]));
      }
      if (items.length > 0) blocks.push({ type: tag, children: items });
    } else {
      blocks.push({ type: tag, children: [parseInline(inner)] });
    }
    lastIndex = blockRe.lastIndex;
  }
  // Resto após último bloco
  const tail = html.slice(lastIndex).trim();
  if (tail && tail.replace(/<[^>]+>/g, "").trim().length > 0) {
    const inline = parseInline(tail);
    if (inline.length > 0) blocks.push({ type: "p", children: [inline] });
  }
  // Se não encontramos nenhum bloco, trata o HTML inteiro como parágrafo.
  if (!foundAny) {
    const inline = parseInline(html);
    if (inline.length > 0) blocks.push({ type: "p", children: [inline] });
  }
  return blocks;
}

function inlineStyle(marks: InlineMarks): Record<string, string | number> {
  const s: Record<string, string | number> = {};
  if (marks.bold && marks.italic) s.fontFamily = "Helvetica-BoldOblique";
  else if (marks.bold) s.fontFamily = "Helvetica-Bold";
  else if (marks.italic) s.fontFamily = "Helvetica-Oblique";
  if (marks.underline) s.textDecoration = "underline";
  if (marks.strike) {
    s.textDecoration = marks.underline ? "line-through underline" : "line-through";
  }
  return s;
}

function renderInline(nodes: InlineNode[], baseKey: string): React.ReactNode {
  return nodes.map((n, i) => (
    <Text key={`${baseKey}-${i}`} style={inlineStyle(n.marks)}>
      {n.text}
    </Text>
  ));
}

export function renderRichHtml(
  html: string | null | undefined,
  styles: PdfStyles,
): React.ReactNode {
  const blocks = parseRichHtml(html);
  if (blocks.length === 0) return null;
  return blocks.map((b, i) => {
    const key = `b-${i}`;
    if (b.type === "h1") {
      return (
        <Text key={key} style={styles.h1}>
          {renderInline(b.children[0] ?? [], key)}
        </Text>
      );
    }
    if (b.type === "h2") {
      return (
        <Text key={key} style={styles.h2}>
          {renderInline(b.children[0] ?? [], key)}
        </Text>
      );
    }
    if (b.type === "h3") {
      return (
        <Text key={key} style={styles.h3}>
          {renderInline(b.children[0] ?? [], key)}
        </Text>
      );
    }
    if (b.type === "ul" || b.type === "ol") {
      return (
        <View key={key} style={{ marginBottom: 4 }}>
          {b.children.map((item, j) => {
            const marker = b.type === "ol" ? `${j + 1}.` : "•";
            return (
              <View key={`${key}-${j}`} style={styles.bulletItem}>
                <Text style={styles.bulletDot}>{marker}</Text>
                <Text style={styles.bulletText}>
                  {renderInline(item, `${key}-${j}`)}
                </Text>
              </View>
            );
          })}
        </View>
      );
    }
    // p
    return (
      <Text key={key} style={styles.p}>
        {renderInline(b.children[0] ?? [], key)}
      </Text>
    );
  });
}
