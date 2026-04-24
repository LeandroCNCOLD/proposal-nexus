// Renderer de blocos do Page Builder. Cada bloco edita seus próprios dados
// inline no canvas A4. Esta é a UI principal do editor.
import { useMemo } from "react";
import { Trash2, Lock, Plus, GripVertical, Sparkles } from "lucide-react";
import type { DocumentBlock, BlockType } from "@/integrations/proposal-editor/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "./RichTextEditor";

type Props = {
  block: DocumentBlock;
  onChange: (next: DocumentBlock) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

export function BlockRenderer({ block, onChange, onDelete, onMoveUp, onMoveDown }: Props) {
  const setData = (patch: Record<string, unknown>) =>
    onChange({ ...block, data: { ...block.data, ...patch } });

  const sourceBadge = useMemo(() => {
    if (block.source === "nomus") return { label: "Nomus", variant: "default" as const };
    if (block.source === "template") return { label: "Template", variant: "secondary" as const };
    return null;
  }, [block.source]);

  return (
    <div className="group relative rounded-lg border border-transparent bg-background p-4 transition hover:border-border hover:shadow-sm">
      {/* Toolbar do bloco */}
      <div className="absolute -top-3 left-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <div className="flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 shadow-sm">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            title="Mover para cima"
            onClick={onMoveUp}
            disabled={!onMoveUp}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">{block.type}</span>
          {sourceBadge ? (
            <Badge variant={sourceBadge.variant} className="h-4 px-1.5 text-[9px]">
              {sourceBadge.label}
            </Badge>
          ) : null}
          {block.locked ? (
            <Lock className="h-3 w-3 text-muted-foreground" aria-label="Bloqueado" />
          ) : null}
        </div>
        {!block.locked ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            title="Remover bloco"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {/* Conteúdo */}
      <BlockBody block={block} setData={setData} />
      {onMoveDown ? null : null /* placeholder p/ futuro */}
    </div>
  );
}

function BlockBody({
  block,
  setData,
}: {
  block: DocumentBlock;
  setData: (patch: Record<string, unknown>) => void;
}) {
  const locked = block.locked;

  switch (block.type) {
    case "heading": {
      const text = (block.data.text as string) ?? "";
      const level = (block.data.level as number) ?? 1;
      const sizeClass = level === 1 ? "text-3xl" : level === 2 ? "text-2xl" : "text-xl";
      return (
        <Input
          value={text}
          onChange={(e) => setData({ text: e.target.value })}
          disabled={locked}
          placeholder="Título da seção…"
          className={`${sizeClass} h-auto border-none bg-transparent px-0 font-bold text-foreground shadow-none focus-visible:ring-0`}
        />
      );
    }

    case "rich_text": {
      const html = (block.data.html as string) ?? "";
      return (
        <div>
          {block.title ? (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {block.title}
            </p>
          ) : null}
          <RichTextEditor
            value={html}
            onChange={(v) => setData({ html: v })}
            placeholder="Escreva o conteúdo…"
          />
        </div>
      );
    }

    case "image": {
      const url = (block.data.url as string | null) ?? null;
      return (
        <div className="space-y-2">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {block.title}
            </p>
          ) : null}
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="max-h-64 rounded border" />
          ) : (
            <div className="flex h-32 items-center justify-center rounded border-2 border-dashed text-xs text-muted-foreground">
              Sem imagem (cole uma URL abaixo)
            </div>
          )}
          <Input
            value={url ?? ""}
            onChange={(e) => setData({ url: e.target.value || null })}
            placeholder="URL da imagem…"
            disabled={locked}
          />
        </div>
      );
    }

    case "key_value_list": {
      const items =
        (block.data.items as Array<{ label: string; value: string }> | undefined) ?? [];
      return (
        <div className="space-y-2">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {block.title}
            </p>
          ) : null}
          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[140px_1fr_auto] gap-2">
                <Input
                  value={it.label}
                  disabled={locked}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, label: e.target.value };
                    setData({ items: next });
                  }}
                  className="h-8 text-xs"
                  placeholder="Rótulo"
                />
                <Input
                  value={it.value}
                  disabled={locked}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, value: e.target.value };
                    setData({ items: next });
                  }}
                  className="h-8 text-xs"
                  placeholder="Valor"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  disabled={locked}
                  onClick={() => setData({ items: items.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={locked}
            onClick={() => setData({ items: [...items, { label: "", value: "" }] })}
          >
            <Plus className="mr-1 h-3 w-3" /> Adicionar campo
          </Button>
        </div>
      );
    }

    case "included_items":
    case "excluded_items": {
      const items = (block.data.items as string[] | undefined) ?? [];
      return (
        <div className="space-y-2">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {block.title}
            </p>
          ) : null}
          <Textarea
            value={items.join("\n")}
            disabled={locked}
            onChange={(e) =>
              setData({ items: e.target.value.split("\n").filter((l) => l.trim().length > 0) })
            }
            rows={Math.max(3, items.length + 1)}
            placeholder={
              block.type === "included_items"
                ? "Um item por linha (incluso)…"
                : "Um item por linha (não incluso)…"
            }
            className="text-sm"
          />
        </div>
      );
    }

    case "client_info":
    case "project_info":
    case "responsible_info":
    case "cover_identity": {
      const fields = Object.entries(block.data ?? {});
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {block.title ?? blockKindLabel(block.type)}
            </p>
          </div>
          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Bloco automático — preenchido pelo template ou pela sincronização Nomus.
            </p>
          ) : (
            <div className="space-y-1.5">
              {fields.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[140px_1fr] gap-2">
                  <span className="text-xs text-muted-foreground">{labelize(key)}</span>
                  <Input
                    value={String(value ?? "")}
                    disabled={locked}
                    onChange={(e) => setData({ [key]: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "investment_table":
    case "tax_table":
    case "payment_table":
    case "characteristics_table":
    case "equipments_table":
    case "technical_table": {
      return (
        <div className="rounded border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{block.title ?? blockKindLabel(block.type)}</p>
          <p className="mt-1">
            Tabela estruturada — edite na aba correspondente do antigo painel de tabelas. A
            integração inline com o canvas A4 será concluída na próxima fase.
          </p>
        </div>
      );
    }

    case "bank_data":
      return (
        <div className="rounded border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{block.title ?? "Dados bancários"}</p>
          <p className="mt-1">Definidos no template. Para alterar, edite o template.</p>
        </div>
      );

    case "signature":
      return (
        <div className="rounded border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{block.title ?? "Assinatura"}</p>
          <p className="mt-1">Assinatura do responsável comercial — gerada automaticamente.</p>
        </div>
      );

    case "attached_pdf": {
      const paths = (block.data.paths as string[] | undefined) ?? [];
      return (
        <div className="space-y-1 text-xs">
          <p className="font-semibold">{block.title ?? "PDFs anexados"}</p>
          {paths.length === 0 ? (
            <p className="text-muted-foreground">Nenhum PDF anexado ainda.</p>
          ) : (
            <ul className="list-disc pl-5">
              {paths.map((p, i) => (
                <li key={i} className="font-mono">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    default:
      return (
        <div className="text-xs text-muted-foreground">
          Bloco do tipo <code>{block.type}</code> ainda não tem renderer dedicado.
        </div>
      );
  }
}

function blockKindLabel(t: BlockType): string {
  const map: Partial<Record<BlockType, string>> = {
    cover_identity: "Identidade visual",
    client_info: "Cliente",
    project_info: "Projeto",
    responsible_info: "Responsável",
    investment_table: "Tabela de investimento",
    tax_table: "Tabela de impostos",
    payment_table: "Tabela de pagamento",
    characteristics_table: "Características técnicas",
    equipments_table: "Tabela de equipamentos",
    technical_table: "Tabela técnica",
    bank_data: "Dados bancários",
    signature: "Assinatura",
    attached_pdf: "PDF anexado",
  };
  return map[t] ?? t;
}

function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
