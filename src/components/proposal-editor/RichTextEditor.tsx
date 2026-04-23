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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { uploadInlineImage } from "@/integrations/proposal-editor/inline-images.functions";
import { toast } from "sonner";

interface Props {
  value?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minimal?: boolean;
  className?: string;
  /** Quando definido, habilita upload de imagens inline para a proposta. */
  proposalId?: string;
}

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
}: {
  editor: Editor;
  minimal?: boolean;
  onPickImage?: () => void;
}) {
  const inTable = editor.isActive("table");
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1">
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
