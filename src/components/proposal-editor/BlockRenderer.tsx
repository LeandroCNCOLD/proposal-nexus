// Renderer de blocos do Page Builder. Cada bloco edita seus próprios dados
// inline no canvas A4, e seu container externo (ProposalCanvas) faz o
// posicionamento absoluto + drag/resize via react-rnd.
import { useMemo, useRef, useState } from "react";
import { Trash2, Lock, Plus, Sparkles, Upload, Loader2, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { uploadInlineImage } from "@/integrations/proposal-editor/inline-images.functions";
import { toast } from "sonner";
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
import { BoxStyleEditor } from "./BoxStyleEditor";
import { InlineTablePreview } from "./InlineTablePreview";
import { layoutToBoxStyle } from "@/integrations/proposal-editor/box-style";

interface Props {
  block: DocumentBlock;
  selected: boolean;
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
  proposalContext: ProposalDynamicContext;
  proposalId?: string;
  pageId?: string;
  onChange: (next: DocumentBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
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
  pageId,
  onChange,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
}: Props) {
  const setData = (patch: Record<string, unknown>) =>
    onChange({ ...block, data: { ...block.data, ...patch } });

  const sourceBadge = useMemo(() => {
    if (block.source === "nomus") return { label: "Nomus", variant: "default" as const };
    if (block.source === "template") return { label: "Template", variant: "secondary" as const };
    return null;
  }, [block.source]);

  const layout = block.data.layout;
  // Quando há configuração avançada (bgMode/borderWidth/etc), o estilo é aplicado
  // diretamente via inline-style, e desabilitamos as classes legadas para não conflitar.
  const hasAdvancedBox =
    !!layout && (
      layout.bgMode !== undefined ||
      layout.borderWidth !== undefined ||
      layout.borderRadius !== undefined ||
      layout.bgOpacity !== undefined
    );
  const cardBg = useMemo(() => {
    if (hasAdvancedBox) return "";
    const bg = layout?.background ?? "transparent";
    if (bg === "white") return "bg-white shadow-sm";
    if (bg === "primary") return "text-white";
    if (bg === "muted") return "bg-muted/60";
    return "";
  }, [layout?.background, hasAdvancedBox]);
  const cardStyle: React.CSSProperties = useMemo(() => {
    const s: React.CSSProperties = {};
    if (hasAdvancedBox) {
      Object.assign(s, layoutToBoxStyle(layout, template?.primary_color ?? undefined));
    } else if (layout?.background === "primary") {
      s.background = template?.primary_color ?? "#0c2340";
    }
    if (layout?.color) s.color = layout.color;
    if (layout?.fontScale) s.fontSize = `${layout.fontScale}em`;
    if (layout?.align) s.textAlign = layout.align;
    const ff = block.data.fontFamily as string | undefined;
    if (ff) s.fontFamily = ff;
    // fontSize em px (definido pelo escalonamento do container ou pelo usuário).
    // Aplicado no wrapper para cascatear aos filhos textuais via herança CSS.
    const fs = block.data.fontSize as number | undefined;
    if (typeof fs === "number" && fs > 0) {
      s.fontSize = `${fs}px`;
      s.lineHeight = 1.25;
    }
    return s;
  }, [layout, template?.primary_color, block.data.fontFamily, block.data.fontSize, hasAdvancedBox]);

  const hasCustomFontSize =
    typeof block.data.fontSize === "number" && (block.data.fontSize as number) > 0;

  return (
    <div
      className={`group relative h-full w-full overflow-visible rounded-md transition ${cardBg} ${
        hasCustomFontSize ? "pe-inherit-font" : ""
      } ${
        selected
          ? "outline outline-2 outline-primary ring-2 ring-primary/30"
          : "outline-dashed outline-1 outline-transparent hover:outline-2 hover:outline-primary/70 hover:bg-primary/5 hover:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"
      }`}
      style={cardStyle}
    >
      {/* Etiqueta de hover — aparece quando o mouse passa sobre o bloco e ele não está selecionado */}
      {!selected ? (
        <div className="pointer-events-none absolute -top-6 left-0 z-40 hidden rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow-md group-hover:block">
          Clique para editar · {block.type}
        </div>
      ) : null}
      {/* Toolbar do bloco selecionado — agrupada por seções rotuladas */}
      {selected ? (
        <div
          className="absolute -top-10 left-0 z-50 flex items-center gap-2 rounded-md border bg-background px-2 py-1 shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Identificação */}
          <div className="flex items-center gap-1">
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

          {/* Grupo: Texto (alinhamento + tamanho) */}
          <ToolbarGroup label="Texto">
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
          </ToolbarGroup>

          {/* Grupo: Caixa (fundo, transparência, borda) — destaque visual para
              indicar que é onde se edita a aparência da caixa em si. */}
          <ToolbarGroup label="Caixa" highlight>
            <BoxStyleEditor
              layout={layout}
              onChange={(nextLayout) => setData({ layout: nextLayout })}
            />
          </ToolbarGroup>

          {/* Grupo: Camadas */}
          <ToolbarGroup label="Camada">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onSendToBack}
              title="Enviar para trás de tudo"
            >
              <ChevronsDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onSendBackward}
              title="Voltar uma camada"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onBringForward}
              title="Trazer uma camada para frente"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onBringToFront}
              title="Trazer para frente de tudo"
            >
              <ChevronsUp className="h-3.5 w-3.5" />
            </Button>
          </ToolbarGroup>

          {/* Grupo: Ações da caixa (duplicar, excluir) */}
          <ToolbarGroup label="Ações">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px]"
              onClick={onDuplicate}
              title="Duplicar a caixa inteira"
            >
              Duplicar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                if (block.locked) {
                  if (!window.confirm("Esta caixa está bloqueada. Deseja excluí-la mesmo assim?")) return;
                }
                onDelete?.();
              }}
              title={block.locked ? "Excluir caixa bloqueada" : "Excluir caixa"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </ToolbarGroup>
        </div>
      ) : null}

      {/* Conteúdo do bloco — padding adapta ao tamanho da fonte para não cortar conteúdo */}
      <div
        className="h-full w-full overflow-hidden rounded-[inherit]"
        style={{
          padding: hasCustomFontSize
            ? `${Math.max(2, Math.min(8, ((block.data.fontSize as number) ?? 12) / 3))}px`
            : "12px",
        }}
      >
        <BlockBody
          block={block}
          template={template}
          assets={assets}
          proposalContext={proposalContext}
          proposalId={proposalId}
          selected={selected}
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
  selected,
  setData,
  onChange,
}: {
  block: DocumentBlock;
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
  proposalContext: ProposalDynamicContext;
  proposalId?: string;
  selected: boolean;
  setData: (patch: Record<string, unknown>) => void;
  onChange: (next: DocumentBlock) => void;
}) {
  const locked = block.locked;

  switch (block.type) {
    case "container": {
      const title = (block.data.title as string | undefined) ?? block.title ?? "";
      const printVisible = (block.data.printVisible as boolean | undefined) ?? true;
      const borderColor = (block.data.borderColor as string | undefined) ?? "#cbd5e1";
      const borderWidth = (block.data.borderWidth as number | undefined) ?? 1;
      const radius = (block.data.radius as number | undefined) ?? 8;
      const backgroundColor =
        (block.data.backgroundColor as string | undefined) ?? "transparent";
      // Quando "não imprimível", mostra apenas guia visual no editor (dashed),
      // sem borda/fundo reais — esta caixa não aparecerá no PDF final.
      const editorBorder = printVisible
        ? `${borderWidth}px solid ${borderColor}`
        : `1px dashed #cbd5e1`;
      const editorBg = printVisible ? backgroundColor : "transparent";
      return (
        <div
          className="relative h-full w-full"
          style={{
            border: editorBorder,
            borderRadius: radius,
            background: editorBg,
          }}
        >
          {!printVisible ? (
            <div
              className="pointer-events-none absolute right-1 top-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-800"
            >
              Não imprime
            </div>
          ) : null}
          {title ? (
            <div
              className="absolute -top-2 left-3 rounded bg-white px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ pointerEvents: "none" }}
            >
              {title}
            </div>
          ) : null}
          <div className="absolute inset-1 flex items-center justify-center">
            <Input
              value={title}
              disabled={locked}
              onChange={(e) => setData({ title: e.target.value })}
              placeholder="Rótulo da caixa (opcional)"
              className="h-7 max-w-[60%] border-dashed bg-white/70 text-center text-[10px] opacity-0 transition group-hover:opacity-100"
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      );
    }

    case "heading": {
      const text = (block.data.text as string) ?? "";
      const level = (block.data.level as number) ?? 1;
      const hasCustomFs = typeof block.data.fontSize === "number";
      const sizeClass = hasCustomFs
        ? "h-auto"
        : level === 1
          ? "text-3xl"
          : level === 2
            ? "text-2xl"
            : "text-xl";
      return (
        <Input
          value={text}
          onChange={(e) => setData({ text: e.target.value })}
          disabled={locked}
          placeholder="Título da seção…"
          className={`${sizeClass} h-auto border-none bg-transparent px-0 font-bold shadow-none focus-visible:ring-0`}
          style={{ color: "inherit", fontSize: hasCustomFs ? "inherit" : undefined }}
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
      const hasCustomFs = typeof block.data.fontSize === "number";
      return (
        <div className="flex h-full flex-col justify-center gap-0.5 leading-tight">
          <div className="flex items-baseline gap-2">
            <span
              className="shrink-0 font-bold uppercase tracking-wider opacity-80"
              style={{ fontSize: hasCustomFs ? "0.75em" : "12px" }}
            >
              Proposta Nº:
            </span>
            <span
              className={hasCustomFs ? "min-w-0 flex-1 truncate font-semibold" : "min-w-0 flex-1 truncate text-base font-semibold"}
              style={{ color: "inherit", fontSize: hasCustomFs ? "1em" : undefined }}
            >
              {proposalContext.proposal_number ?? "—"}
            </span>
          </div>
          {proposalContext.data_emissao ? (
            <div className="flex items-baseline gap-2">
              <span
                className="shrink-0 font-bold uppercase tracking-wider opacity-80"
                style={{ fontSize: hasCustomFs ? "0.75em" : "12px" }}
              >
                Data:
              </span>
              <span
                className={hasCustomFs ? "min-w-0 flex-1 truncate font-semibold" : "min-w-0 flex-1 truncate text-base font-semibold"}
                style={{ color: "inherit", fontSize: hasCustomFs ? "1em" : undefined }}
              >
                {proposalContext.data_emissao}
              </span>
            </div>
          ) : null}
        </div>
      );
    }

    case "proposal_summary_box": {
      // Caixa-resumo padrão: lista personalizável de campos com gestão visual
      // (editar rótulo/valor, excluir, adicionar do catálogo, reordenar).
      const hasCustomFs = typeof block.data.fontSize === "number";
      const labelColor = (block.data.labelColor as string | undefined) ?? undefined;

      type SummaryField = { key: string; label: string; valueKey?: string; value?: string };
      const defaultFields: SummaryField[] = [
        { key: "cliente", label: "Cliente:", valueKey: "client_name" },
        { key: "projeto", label: "Projeto:", valueKey: "proposal_title" },
        { key: "proposta", label: "Proposta:", valueKey: "proposal_number" },
        { key: "data", label: "Data:", valueKey: "data_emissao" },
        { key: "responsavel", label: "Responsável Comercial:", valueKey: "vendedor" },
      ];
      const fields: SummaryField[] =
        (block.data.fields as SummaryField[] | undefined) ?? defaultFields;

      const catalog: Array<{ key: string; label: string; valueKey: keyof ProposalDynamicContext }> = [
        { key: "cliente", label: "Cliente:", valueKey: "client_name" },
        { key: "projeto", label: "Projeto:", valueKey: "proposal_title" },
        { key: "proposta", label: "Proposta:", valueKey: "proposal_number" },
        { key: "data_emissao", label: "Data:", valueKey: "data_emissao" },
        { key: "validade", label: "Validade:", valueKey: "validade" },
        { key: "responsavel", label: "Responsável Comercial:", valueKey: "vendedor" },
        { key: "telefone", label: "Telefone:", valueKey: "empresa_telefone" },
        { key: "email", label: "E-mail:", valueKey: "empresa_email" },
        { key: "site", label: "Site:", valueKey: "empresa_site" },
      ];

      const resolveValue = (f: SummaryField): string => {
        if (f.value !== undefined) return f.value;
        if (f.valueKey) {
          const v = (proposalContext as Record<string, string | null | undefined>)[f.valueKey];
          return v ?? "";
        }
        return "";
      };

      const updateFields = (next: SummaryField[]) => setData({ fields: next });
      const updateField = (idx: number, patch: Partial<SummaryField>) => {
        const next = [...fields];
        next[idx] = { ...next[idx], ...patch };
        updateFields(next);
      };
      const removeField = (idx: number) => updateFields(fields.filter((_, i) => i !== idx));
      const moveField = (idx: number, dir: -1 | 1) => {
        const j = idx + dir;
        if (j < 0 || j >= fields.length) return;
        const next = [...fields];
        [next[idx], next[j]] = [next[j], next[idx]];
        updateFields(next);
      };
      const addCustomField = () => {
        const k = `custom_${Date.now()}`;
        updateFields([...fields, { key: k, label: "Novo campo:", value: "" }]);
      };
      const addCatalogField = (c: (typeof catalog)[number]) => {
        if (fields.some((f) => f.key === c.key)) return;
        updateFields([...fields, { key: c.key, label: c.label, valueKey: c.valueKey }]);
      };

      return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5 leading-snug">
          {fields.map((f, idx) => {
            const value = resolveValue(f);
            return (
              <div
                key={`${f.key}-${idx}`}
                className="group/field grid items-baseline gap-x-3"
                style={{ gridTemplateColumns: "max-content minmax(0, 1fr) auto" }}
              >
                {selected && !locked ? (
                  <input
                    value={f.label}
                    onChange={(e) => updateField(idx, { label: e.target.value })}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="rounded border border-dashed border-transparent bg-transparent px-0.5 font-bold outline-none hover:border-primary/40 focus:border-primary"
                    style={{
                      color: labelColor,
                      fontSize: hasCustomFs ? "1em" : undefined,
                      whiteSpace: "nowrap",
                      width: `${Math.max(f.label.length, 4)}ch`,
                    }}
                  />
                ) : (
                  <span
                    className="font-bold"
                    style={{
                      color: labelColor,
                      fontSize: hasCustomFs ? "1em" : undefined,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.label}
                  </span>
                )}

                {selected && !locked && !f.valueKey ? (
                  <input
                    value={f.value ?? ""}
                    onChange={(e) => updateField(idx, { value: e.target.value })}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="Valor…"
                    className="min-w-0 rounded border border-dashed border-transparent bg-transparent px-0.5 font-semibold outline-none hover:border-primary/40 focus:border-primary"
                    style={{ fontSize: hasCustomFs ? "1em" : undefined }}
                  />
                ) : (
                  <span
                    className="font-semibold"
                    style={{
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      whiteSpace: "normal",
                      fontSize: hasCustomFs ? "1em" : undefined,
                    }}
                  >
                    {value || <span className="opacity-40">—</span>}
                  </span>
                )}

                {selected && !locked ? (
                  <div
                    className="flex items-center gap-0.5 opacity-0 transition group-hover/field:opacity-100"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Mover para cima"
                      className="rounded px-1 text-[10px] hover:bg-muted disabled:opacity-30"
                      onClick={() => moveField(idx, -1)}
                      disabled={idx === 0}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      title="Mover para baixo"
                      className="rounded px-1 text-[10px] hover:bg-muted disabled:opacity-30"
                      onClick={() => moveField(idx, 1)}
                      disabled={idx === fields.length - 1}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      title="Remover este campo"
                      className="rounded px-1 text-[10px] text-destructive hover:bg-destructive/10"
                      onClick={() => removeField(idx)}
                    >
                      ✕
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {selected && !locked ? (
            <div
              className="mt-1 flex flex-wrap items-center gap-1 border-t border-dashed pt-1"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">
                    <Plus className="mr-1 h-3 w-3" />
                    Adicionar campo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="z-[60] max-h-72 overflow-auto"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {catalog.map((c) => {
                    const already = fields.some((f) => f.key === c.key);
                    return (
                      <DropdownMenuItem
                        key={c.key}
                        disabled={already}
                        onSelect={() => addCatalogField(c)}
                        className="text-xs"
                      >
                        {c.label.replace(":", "")}
                        {already ? <span className="ml-2 opacity-50">(já incluído)</span> : null}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuItem onSelect={addCustomField} className="text-xs font-medium">
                    + Campo personalizado
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-muted-foreground"
                onClick={() => updateFields(defaultFields)}
                title="Restaurar campos padrão"
              >
                Restaurar padrão
              </Button>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {fields.length} campo{fields.length === 1 ? "" : "s"}
              </span>
            </div>
          ) : null}
        </div>
      );
    }

    case "dynamic_field": {
      const fieldKey = (block.data.fieldKey as string) ?? "";
      const label = (block.data.label as string) ?? labelize(fieldKey);
      const value = resolveDynamicField(fieldKey, proposalContext, template);
      const hasCustomFs = typeof block.data.fontSize === "number";
      return (
        <div className="group/df relative flex h-full items-center leading-tight">
          <div className="flex w-full items-baseline gap-2">
            <span
              className="shrink-0 whitespace-nowrap font-bold uppercase tracking-wider opacity-80"
              style={{ fontSize: hasCustomFs ? "0.75em" : "12px" }}
            >
              {label}:
            </span>
            <span
              className={hasCustomFs ? "min-w-0 flex-1 truncate font-semibold" : "min-w-0 flex-1 truncate text-base font-semibold"}
              style={{ color: "inherit", fontSize: hasCustomFs ? "1em" : undefined }}
              title={value || undefined}
            >
              {value || "—"}
            </span>
          </div>
          {/* Editor de chave — só aparece em hover/seleção pra não roubar espaço do conteúdo */}
          <Input
            value={fieldKey}
            disabled={locked}
            onChange={(e) => setData({ fieldKey: e.target.value })}
            placeholder="ex: client_name"
            className="absolute bottom-0 left-0 right-0 h-5 w-auto text-[9px] opacity-0 transition group-hover/df:opacity-80 focus:opacity-100"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      );
    }

    case "differentials_list": {
      const items =
        (block.data.items as TemplateDiferencial[] | undefined) ??
        template?.sobre_diferenciais ??
        [];
      const emptyText = (block.data.emptyText as string | undefined) ?? "Defina os diferenciais do template.";
      return (
        <div className="h-full space-y-2 overflow-auto">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
              {block.title}
            </p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {items.length === 0 ? (
              <li className="opacity-60">{emptyText}</li>
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
      const emptyText = (block.data.emptyText as string | undefined) ?? "Defina os cases no template.";
      return (
        <div className="h-full space-y-2 overflow-auto">
          {block.title ? (
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
              {block.title}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {items.length === 0 ? (
              <p className="col-span-2 text-xs opacity-60">{emptyText}</p>
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
    proposal_summary_box: "Resumo da proposta",
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

function ImageUploadButton({
  proposalId,
  onUploaded,
  disabled,
}: {
  proposalId: string;
  onUploaded: (url: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadInlineImage);
  const [busy, setBusy] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Máx 5MB.");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const res = await upload({
        data: {
          proposalId,
          filename: file.name,
          contentBase64: btoa(bin),
          mimeType: file.type,
        },
      });
      onUploaded(res.url);
      toast.success("Imagem enviada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-[10px]"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        title="Fazer upload de imagem"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
    </>
  );
}


// Pequeno agrupador visual para a toolbar superior do bloco.
// Renderiza um rótulo discreto acima dos controles para deixar claro
// o que cada conjunto de botões controla (Texto, Caixa, Camada, Ações).
function ToolbarGroup({
  label,
  highlight,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded px-1.5 py-0.5 ${
        highlight ? "bg-primary/10 ring-1 ring-primary/30" : ""
      }`}
    >
      <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  );
}
