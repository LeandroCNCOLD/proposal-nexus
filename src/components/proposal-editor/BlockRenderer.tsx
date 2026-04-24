// Renderer de blocos do Page Builder. Cada bloco edita seus próprios dados
// inline no canvas A4, e seu container externo (ProposalCanvas) faz o
// posicionamento absoluto + drag/resize via react-rnd.
import { useMemo } from "react";
import { Trash2, Lock, Plus, Sparkles } from "lucide-react";
import type { DocumentBlock, BlockType } from "@/integrations/proposal-editor/types";
import type {
  ProposalTemplate,
  TemplateAsset,
  TemplateCaseItem,
  TemplateDiferencial,
} from "@/integrations/proposal-editor/template.types";
import { normalizeDadosBancarios } from "@/integrations/proposal-editor/template.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextEditor } from "./RichTextEditor";

interface Props {
  block: DocumentBlock;
  selected: boolean;
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
  proposalContext: ProposalDynamicContext;
  proposalId?: string;
  onChange: (next: DocumentBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

/** Valores dinâmicos preenchidos a partir da proposta + Nomus. */
export interface ProposalDynamicContext {
  proposal_number?: string | null;
  proposal_title?: string | null;
  client_name?: string | null;
  data_emissao?: string | null;
  validade?: string | null;
  vendedor?: string | null;
  empresa_telefone?: string | null;
  empresa_site?: string | null;
  empresa_email?: string | null;
}

export function BlockRenderer({
  block,
  selected,
  template,
  assets,
  proposalContext,
  proposalId,
  onChange,
  onDelete,
  onDuplicate,
}: Props) {
  const setData = (patch: Record<string, unknown>) =>
    onChange({ ...block, data: { ...block.data, ...patch } });

  const sourceBadge = useMemo(() => {
    if (block.source === "nomus") return { label: "Nomus", variant: "default" as const };
    if (block.source === "template") return { label: "Template", variant: "secondary" as const };
    return null;
  }, [block.source]);

  const layout = block.data.layout;
  const cardBg = useMemo(() => {
    const bg = layout?.background ?? "transparent";
    if (bg === "white") return "bg-white shadow-sm";
    if (bg === "primary") return "text-white";
    if (bg === "muted") return "bg-muted/60";
    return "";
  }, [layout?.background]);
  const cardStyle: React.CSSProperties = useMemo(() => {
    const s: React.CSSProperties = {};
    if (layout?.background === "primary") {
      s.background = template?.primary_color ?? "#0c2340";
    }
    if (layout?.color) s.color = layout.color;
    if (layout?.fontScale) s.fontSize = `${layout.fontScale}em`;
    if (layout?.align) s.textAlign = layout.align;
    return s;
  }, [layout, template?.primary_color]);

  return (
    <div
      className={`group relative h-full w-full rounded-md transition ${cardBg} ${
        selected ? "outline outline-2 outline-primary" : "outline outline-1 outline-transparent hover:outline-border"
      }`}
      style={cardStyle}
    >
      {/* Toolbar do bloco selecionado */}
      {selected ? (
        <div
          className="absolute -top-9 left-0 z-50 flex items-center gap-1 rounded-md border bg-background px-1.5 py-1 shadow-sm"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="font-mono text-[10px] text-muted-foreground">{block.type}</span>
          {sourceBadge ? (
            <Badge variant={sourceBadge.variant} className="h-4 px-1.5 text-[9px]">
              {sourceBadge.label}
            </Badge>
          ) : null}
          {block.locked ? (
            <Lock className="h-3 w-3 text-muted-foreground" aria-label="Bloqueado" />
          ) : null}
          <span className="mx-1 text-muted-foreground/50">·</span>
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={`rounded px-1 text-[10px] ${
                (layout?.align ?? "left") === a ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
              onClick={() => setData({ layout: { ...layout!, align: a } })}
              title={`Alinhar ${a}`}
            >
              {a === "left" ? "⟸" : a === "center" ? "⇔" : "⟹"}
            </button>
          ))}
          <span className="mx-1 text-muted-foreground/50">·</span>
          {[0.85, 1, 1.15, 1.3].map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded px-1 text-[10px] ${
                (layout?.fontScale ?? 1) === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
              onClick={() => setData({ layout: { ...layout!, fontScale: s } })}
              title={`Tamanho ${s}x`}
            >
              {s === 1 ? "1x" : `${s}x`}
            </button>
          ))}
          <span className="mx-1 text-muted-foreground/50">·</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={onDuplicate}
            title="Duplicar bloco"
          >
            Duplicar
          </Button>
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
      ) : null}

      {/* Conteúdo do bloco */}
      <div className="h-full w-full overflow-hidden p-3">
        <BlockBody
          block={block}
          template={template}
          assets={assets}
          proposalContext={proposalContext}
          proposalId={proposalId}
          setData={setData}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function BlockBody({
  block,
  template,
  assets,
  proposalContext,
  proposalId,
  setData,
  onChange,
}: {
  block: DocumentBlock;
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
  proposalContext: ProposalDynamicContext;
  proposalId?: string;
  setData: (patch: Record<string, unknown>) => void;
  onChange: (next: DocumentBlock) => void;
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
          className={`${sizeClass} h-auto border-none bg-transparent px-0 font-bold shadow-none focus-visible:ring-0`}
          style={{ color: "inherit" }}
        />
      );
    }

    case "rich_text": {
      const html = (block.data.html as string) ?? "";
      return (
        <div className="h-full">
          {block.title ? (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider opacity-70">
              {block.title}
            </p>
          ) : null}
          <RichTextEditor
            value={html}
            onChange={(v) => setData({ html: v })}
            placeholder="Escreva o conteúdo…"
            proposalId={proposalId}
          />
        </div>
      );
    }

    case "image": {
      const url = (block.data.url as string | null) ?? null;
      return (
        <div className="space-y-2">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
              {block.title}
            </p>
          ) : null}
          {url ? (
            <img src={url} alt="" className="h-full max-h-full w-full max-w-full rounded border object-contain" />
          ) : (
            <div className="flex h-32 items-center justify-center rounded border-2 border-dashed text-xs opacity-60">
              Sem imagem
            </div>
          )}
          <div className="flex items-center gap-1">
            <Input
              value={url ?? ""}
              onChange={(e) => setData({ url: e.target.value || null })}
              placeholder="URL da imagem ou faça upload…"
              disabled={locked}
              className="h-7 text-xs"
            />
            {proposalId ? (
              <ImageUploadButton
                proposalId={proposalId}
                onUploaded={(u) => setData({ url: u })}
                disabled={locked}
              />
            ) : null}
          </div>
        </div>
      );
    }


    case "key_value_list": {
      const items = (block.data.items as Array<{ label: string; value: string }> | undefined) ?? [];
      return (
        <div className="space-y-2">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
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
                  className="h-7 text-xs"
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
                  className="h-7 text-xs"
                  placeholder="Valor"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={locked}
                  onClick={() => setData({ items: items.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            disabled={locked}
            onClick={() => setData({ items: [...items, { label: "", value: "" }] })}
          >
            <Plus className="mr-1 h-3 w-3" /> Adicionar
          </Button>
        </div>
      );
    }

    case "included_items":
    case "excluded_items": {
      const items = (block.data.items as string[] | undefined) ?? [];
      return (
        <div className="h-full space-y-2">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
              {block.title}
            </p>
          ) : null}
          <Textarea
            value={items.join("\n")}
            disabled={locked}
            onChange={(e) =>
              setData({ items: e.target.value.split("\n").filter((l) => l.trim().length > 0) })
            }
            placeholder={
              block.type === "included_items"
                ? "Um item por linha (incluso)…"
                : "Um item por linha (não incluso)…"
            }
            className="h-[calc(100%-1.5rem)] resize-none text-sm"
          />
        </div>
      );
    }

    case "client_info_box":
    case "project_info_box":
    case "responsible_info_box":
    case "client_info":
    case "project_info":
    case "responsible_info":
    case "cover_identity": {
      if (block.type === "cover_identity") {
        return (
          <div className="flex h-full items-end p-6 text-white">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">Capa</p>
              <p className="text-2xl font-bold">{template?.empresa_nome ?? "CN Cold"}</p>
              <p className="text-sm opacity-90">{template?.capa_titulo ?? "Proposta Comercial"}</p>
            </div>
          </div>
        );
      }
      const fields = Object.entries(block.data ?? {}).filter(([k]) => k !== "layout");
      const usedKeys = new Set(fields.map(([k]) => k));
      const suggestions = SUGGESTED_FIELDS[block.type] ?? [];
      const available = suggestions.filter((s) => !usedKeys.has(s.key));
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
                {block.title ?? blockKindLabel(block.type)}
              </p>
            </div>
            {!locked && available.length > 0 ? (
              <FieldPicker
                options={available}
                onPick={(opt) => setData({ [opt.key]: "" })}
              />
            ) : null}
          </div>
          {fields.length === 0 ? (
            <p className="text-xs opacity-60">
              Sem campos. Use <strong>+ Campo</strong> para adicionar.
            </p>
          ) : (
            <div className="space-y-1.5">
              {fields.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[120px_1fr_auto] gap-2">
                  <span className="text-xs opacity-70">{labelForField(block.type, key)}</span>
                  <Input
                    value={String(value ?? "")}
                    disabled={locked}
                    onChange={(e) => setData({ [key]: e.target.value })}
                    className="h-7 text-xs"
                  />
                  {!locked ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      title="Remover campo"
                      onClick={() => {
                        const { [key]: _omit, ...rest } = block.data;
                        void _omit;
                        onChange({ ...block, data: rest });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "proposal_number_box": {
      return (
        <div className="flex h-full flex-col justify-center text-right">
          <p className="text-[10px] uppercase tracking-widest opacity-60">Proposta Nº</p>
          <p className="text-2xl font-bold leading-tight" style={{ color: "inherit" }}>
            {proposalContext.proposal_number ?? "—"}
          </p>
          {proposalContext.data_emissao ? (
            <p className="text-[10px] opacity-70">{proposalContext.data_emissao}</p>
          ) : null}
        </div>
      );
    }

    case "dynamic_field": {
      const fieldKey = (block.data.fieldKey as string) ?? "";
      const label = (block.data.label as string) ?? labelize(fieldKey);
      const value = resolveDynamicField(fieldKey, proposalContext, template);
      return (
        <div className="flex h-full flex-col justify-center">
          <p className="text-[9px] uppercase tracking-widest opacity-60">{label}</p>
          <p className="text-lg font-semibold leading-tight" style={{ color: "inherit" }}>
            {value || "—"}
          </p>
          <Input
            value={fieldKey}
            disabled={locked}
            onChange={(e) => setData({ fieldKey: e.target.value })}
            placeholder="ex: client_name"
            className="mt-1 h-6 text-[10px] opacity-50 hover:opacity-100"
          />
        </div>
      );
    }

    case "differentials_list": {
      const items =
        (block.data.items as TemplateDiferencial[] | undefined) ??
        template?.sobre_diferenciais ??
        [];
      return (
        <div className="h-full space-y-2 overflow-auto">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
              {block.title}
            </p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {items.length === 0 ? (
              <li className="opacity-60">Defina os diferenciais no template.</li>
            ) : (
              items.map((d, i) => (
                <li key={i} className="rounded border bg-white/60 p-2">
                  <p className="font-semibold">{d.titulo}</p>
                  {d.descricao ? <p className="text-xs opacity-80">{d.descricao}</p> : null}
                </li>
              ))
            )}
          </ul>
        </div>
      );
    }

    case "cases_list": {
      const items =
        (block.data.items as TemplateCaseItem[] | undefined) ?? template?.cases_itens ?? [];
      return (
        <div className="h-full space-y-2 overflow-auto">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
              {block.title}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {items.length === 0 ? (
              <p className="col-span-2 text-xs opacity-60">Defina os cases no template.</p>
            ) : (
              items.map((c, i) => (
                <div key={i} className="rounded border bg-white/60 p-2 text-xs">
                  <p className="font-semibold">{c.titulo}</p>
                  {c.cliente ? <p className="opacity-70">{c.cliente}</p> : null}
                  {c.descricao ? <p className="mt-1 opacity-80">{c.descricao}</p> : null}
                </div>
              ))
            )}
          </div>
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
        <div className="rounded border border-dashed bg-muted/40 p-3 text-xs opacity-80">
          <p className="font-semibold">{block.title ?? blockKindLabel(block.type)}</p>
          <p className="mt-1">
            Tabela estruturada — edite na aba de tabelas. O conteúdo será renderizado no PDF.
          </p>
        </div>
      );
    }

    case "bank_data": {
      const banks = normalizeDadosBancarios(template?.dados_bancarios);
      return (
        <div className="h-full space-y-2 overflow-auto text-xs">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
              {block.title}
            </p>
          ) : null}
          {banks.length === 0 ? (
            <p className="opacity-60">Defina os dados bancários no template.</p>
          ) : (
            banks.map((b, i) => (
              <div key={i} className="rounded border bg-white/60 p-2">
                <p className="font-semibold">{b.banco}</p>
                {b.agencia ? <p>Agência: {b.agencia}</p> : null}
                {b.conta ? <p>Conta: {b.conta}</p> : null}
                {b.pix ? <p>Pix: {b.pix}</p> : null}
                {b.titular ? <p>Titular: {b.titular}</p> : null}
              </div>
            ))
          )}
        </div>
      );
    }

    case "signature":
      return (
        <div className="flex h-full flex-col justify-end text-xs">
          <div className="border-t pt-1">
            <p className="font-semibold">{template?.empresa_nome ?? "Responsável"}</p>
            <p className="opacity-70">{template?.empresa_email ?? ""}</p>
          </div>
        </div>
      );

    case "attached_pdf": {
      const paths = (block.data.paths as string[] | undefined) ?? [];
      return (
        <div className="space-y-1 text-xs">
          <p className="font-semibold">{block.title ?? "PDFs anexados"}</p>
          {paths.length === 0 ? (
            <p className="opacity-60">Nenhum PDF anexado ainda.</p>
          ) : (
            <ul className="list-disc pl-5">
              {paths.map((p, i) => (
                <li key={i} className="font-mono text-[10px]">
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
        <div className="text-xs opacity-60">
          Bloco do tipo <code>{block.type}</code> ainda não tem renderer dedicado.
        </div>
      );
  }
  void assets;
}

function resolveDynamicField(
  key: string,
  ctx: ProposalDynamicContext,
  template: ProposalTemplate | null,
): string {
  const map: Record<string, string | null | undefined> = {
    proposal_number: ctx.proposal_number,
    proposal_title: ctx.proposal_title,
    client_name: ctx.client_name,
    data_emissao: ctx.data_emissao,
    data: ctx.data_emissao,
    validade: ctx.validade,
    vendedor: ctx.vendedor,
    empresa_nome: template?.empresa_nome,
    empresa_telefone: template?.empresa_telefone ?? ctx.empresa_telefone,
    empresa_email: template?.empresa_email ?? ctx.empresa_email,
    empresa_site: template?.empresa_site ?? ctx.empresa_site,
    empresa_cidade: template?.empresa_cidade,
  };
  return (map[key] ?? "") || "";
}

function blockKindLabel(t: BlockType): string {
  const map: Partial<Record<BlockType, string>> = {
    cover_identity: "Identidade visual",
    client_info: "Cliente",
    client_info_box: "Cliente",
    project_info: "Projeto",
    project_info_box: "Projeto",
    responsible_info: "Responsável",
    responsible_info_box: "Responsável",
    proposal_number_box: "Nº da proposta",
    dynamic_field: "Campo dinâmico",
    differentials_list: "Diferenciais",
    cases_list: "Cases",
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
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Catálogo de campos sugeridos por tipo de caixa.
interface SuggestedField {
  key: string;
  label: string;
}
const SUGGESTED_FIELDS: Partial<Record<BlockType, SuggestedField[]>> = {
  client_info_box: [
    { key: "cliente", label: "Cliente" },
    { key: "cnpj", label: "CNPJ" },
    { key: "ie", label: "Inscrição Estadual" },
    { key: "endereco", label: "Endereço" },
    { key: "cidade", label: "Cidade/UF" },
    { key: "cep", label: "CEP" },
    { key: "contato", label: "Contato" },
    { key: "email", label: "E-mail" },
    { key: "telefone", label: "Telefone" },
  ],
  client_info: [
    { key: "cliente", label: "Cliente" },
    { key: "cnpj", label: "CNPJ" },
    { key: "endereco", label: "Endereço" },
    { key: "contato", label: "Contato" },
  ],
  project_info_box: [
    { key: "projeto", label: "Projeto" },
    { key: "numero", label: "Nº da proposta" },
    { key: "revisao", label: "Revisão" },
    { key: "data", label: "Data de emissão" },
    { key: "validade", label: "Validade" },
    { key: "prazo_entrega", label: "Prazo de entrega" },
    { key: "local_instalacao", label: "Local de instalação" },
    { key: "tabela_preco", label: "Tabela de preço" },
  ],
  project_info: [
    { key: "projeto", label: "Projeto" },
    { key: "numero", label: "Nº da proposta" },
    { key: "data", label: "Data" },
    { key: "revisao", label: "Revisão" },
  ],
  responsible_info_box: [
    { key: "responsavel", label: "Responsável" },
    { key: "cargo", label: "Cargo" },
    { key: "email", label: "E-mail" },
    { key: "telefone", label: "Telefone" },
    { key: "celular", label: "Celular" },
    { key: "vendedor", label: "Vendedor" },
    { key: "representante", label: "Representante" },
  ],
  responsible_info: [
    { key: "responsavel", label: "Responsável" },
    { key: "cargo", label: "Cargo" },
    { key: "email", label: "E-mail" },
    { key: "telefone", label: "Telefone" },
  ],
};

function labelForField(blockType: BlockType, key: string): string {
  const list = SUGGESTED_FIELDS[blockType];
  const found = list?.find((f) => f.key === key);
  return found?.label ?? labelize(key);
}

function FieldPicker({
  options,
  onPick,
}: {
  options: SuggestedField[];
  onPick: (opt: SuggestedField) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-2 text-[10px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Plus className="h-3 w-3" />
          Campo
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.key}
            onClick={() => onPick(opt)}
            className="text-xs"
          >
            {opt.label}
            <span className="ml-auto pl-3 font-mono text-[9px] opacity-50">{opt.key}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

