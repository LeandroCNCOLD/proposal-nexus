import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading2,
  Heading3,
  Undo,
  Redo,
  ImageIcon,
  Table as TableIcon,
  Trash2,
  Rows,
  Columns,
  Strikethrough,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { uploadInlineImage } from "@/integrations/proposal-editor/inline-images.functions";
import { toast } from "sonner";

import { AIAssistButton } from "./AIAssistButton";

interface Props {
  value?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minimal?: boolean;
  className?: string;
  /** Quando definido, habilita upload de imagens inline para a proposta. */
  proposalId?: string;
  /** Dica de contexto passada ao assistente de IA (ex.: "página: Nossa Solução"). */
  aiContextHint?: string;
}

const FONT_SIZES = [
  { label: "10", value: "10px" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
  { label: "32", value: "32px" },
];

const FONT_FAMILIES = [
  { label: "Padrão", value: "" },
  { label: "Sans (Inter)", value: "Inter, system-ui, sans-serif" },
  { label: "Serif (Georgia)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, monospace" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
];

const TEXT_COLORS = [
  "#000000", "#374151", "#6b7280", "#ffffff",
  "#dc2626", "#ea580c", "#d97706", "#16a34a",
  "#0ea5e9", "#2563eb", "#7c3aed", "#db2777",
];

// Extensão de FontSize via TextStyle (sem dependência adicional).
import { Extension } from "@tiptap/core";
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: { fontSize?: string | null }) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: { chain: () => { setMark: (a: string, b: object) => { run: () => boolean } } }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => { setMark: (a: string, b: object) => { run: () => boolean } } }) =>
          chain().setMark("textStyle", { fontSize: null }).run(),
    } as never;
  },
});

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  minimal,
  onPickImage,
  aiContextHint,
}: {
  editor: Editor;
  minimal?: boolean;
  onPickImage?: () => void;
  aiContextHint?: string;
}) {
  const inTable = editor.isActive("table");
  const currentColor = (editor.getAttributes("textStyle").color as string) ?? "";
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string) ?? "";
  const currentSize = (editor.getAttributes("textStyle").fontSize as string) ?? "";

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1">
      {!minimal && (
        <>
          <select
            value={currentFont}
            onChange={(e) => {
              const v = e.target.value;
              if (v) editor.chain().focus().setFontFamily(v).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
            className="h-6 rounded border bg-background px-1 text-[10px]"
            title="Fonte"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={currentSize}
            onChange={(e) => {
              const v = e.target.value;
              const c = editor.chain().focus() as unknown as {
                setFontSize: (s: string) => { run: () => boolean };
                unsetFontSize: () => { run: () => boolean };
              };
              if (v) c.setFontSize(v).run();
              else c.unsetFontSize().run();
            }}
            className="h-6 rounded border bg-background px-1 text-[10px]"
            title="Tamanho da fonte"
          >
            <option value="">Tam.</option>
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="mx-1 h-4 w-px bg-border" />
        </>
      )}

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Tachado"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarBtn>

      {/* Cor */}
      <div className="relative ml-1 flex items-center">
        <input
          type="color"
          value={currentColor || "#000000"}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          className="h-5 w-5 cursor-pointer rounded border bg-transparent p-0"
          title="Cor do texto"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().unsetColor().run()}
          className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted"
          title="Remover cor"
        >
          <Eraser className="h-3 w-3" />
        </button>
      </div>
      <div className="ml-1 flex gap-0.5">
        {TEXT_COLORS.slice(0, 6).map((c) => (
          <button
            key={c}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setColor(c).run()}
            className="h-3.5 w-3.5 rounded-sm border border-border/50"
            style={{ background: c }}
            title={c}
          />
        ))}
      </div>

      <div className="mx-1 h-4 w-px bg-border" />
      {!minimal && (
        <>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Título"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Subtítulo"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <div className="mx-1 h-4 w-px bg-border" />
        </>
      )}
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Lista"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Lista numerada"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>
      {!minimal && (
        <>
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarBtn
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
            title="Alinhar à esquerda"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            title="Centralizar"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            title="Alinhar à direita"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </>
      )}
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarBtn
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL", prev ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
        active={editor.isActive("link")}
        title="Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      {onPickImage && (
        <ToolbarBtn onClick={onPickImage} title="Inserir imagem">
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
      )}
      {!minimal && (
        <>
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarBtn
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            title="Inserir tabela"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          {inTable && (
            <>
              <ToolbarBtn
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="Adicionar linha"
              >
                <Rows className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="Adicionar coluna"
              >
                <Columns className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().deleteTable().run()}
                title="Remover tabela"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </ToolbarBtn>
            </>
          )}
        </>
      )}
      <div className="ml-auto flex items-center gap-0.5">
        <AIAssistButton
          contextHint={aiContextHint}
          getText={() => {
            const { from, to, empty } = editor.state.selection;
            if (!empty) {
              const slice = editor.state.doc.cut(from, to);
              const tmp = document.createElement("div");
              const fragHtml = (editor as unknown as { getHTML: () => string }).getHTML();
              // Para seleção, usamos o texto puro do trecho selecionado, mas devolvemos
              // o HTML do bloco inteiro como referência visual (mais útil no preview).
              const selText = slice.textContent || "";
              tmp.innerHTML = `<p>${selText.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`;
              return { text: selText, html: fragHtml, hasSelection: true };
            }
            return {
              text: editor.getText(),
              html: editor.getHTML(),
              hasSelection: false,
            };
          }}
          onApply={(html) => {
            const { from, to, empty } = editor.state.selection;
            if (!empty) {
              editor.chain().focus().insertContentAt({ from, to }, html).run();
            } else {
              editor.commands.setContent(html, true);
            }
          }}
          onInsertAfter={(html) => {
            const { to } = editor.state.selection;
            editor.chain().focus().insertContentAt(to, html).run();
          }}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Refazer (Ctrl+Y)"
        >
          <Redo className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minimal,
  className,
  proposalId,
  aiContextHint,
}: Props) {
  const uploadFn = useServerFn(uploadInlineImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Comece a escrever…" }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize,
    ],
    content: value ?? "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[120px] px-3 py-2 focus:outline-none [&_p]:my-1 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_img]:rounded [&_img]:max-w-full [&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Mantém o editor sincronizado quando o value externo muda (auto-fill, etc.)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value ?? "") !== current) {
      editor.commands.setContent(value ?? "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const handlePickImage = proposalId
    ? () => fileInputRef.current?.click()
    : undefined;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !proposalId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB).");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const base64 = btoa(bin);
      const res = await uploadFn({
        data: {
          proposalId,
          filename: file.name,
          contentBase64: base64,
          mimeType: file.type,
        },
      });
      editor.chain().focus().setImage({ src: res.url }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao subir imagem.");
    }
  };

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <Toolbar editor={editor} minimal={minimal} onPickImage={handlePickImage} />
      <EditorContent editor={editor} />
      {proposalId && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </div>
  );
}
