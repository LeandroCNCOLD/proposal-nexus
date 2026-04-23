import { Text, View, Image } from "@react-pdf/renderer";
import type { PdfPalette } from "./styles";
import { StandardPage } from "./StandardPage";
import type { ContextData, ScopeItem, SolutionData } from "../types";
import type { ProposalTemplate, TemplateAsset, TemplateCaseItem, TemplateGarantiaItem, TemplateDiferencial } from "../template.types";

const fmtBRL = (n?: number) =>
  typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

interface PageCtx {
  palette: PdfPalette;
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
  logoUrl?: string;
  headerBannerUrl?: string;
  footerBannerUrl?: string;
}

function Bullet({ palette, children }: { palette: PdfPalette; children: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      <Text style={{ width: 12, color: palette.accent }}>•</Text>
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

export function AboutPage({ palette, template, assets, logoUrl }: PageCtx) {
  const paragrafos = (template?.sobre_paragrafos ?? []) as string[];
  const diferenciais = (template?.sobre_diferenciais ?? []) as TemplateDiferencial[];
  const fotoFabrica = assets.find((a) => a.asset_kind === "about_photo")?.url;
  return (
    <StandardPage title={template?.sobre_titulo || "Sobre a CN Cold"} palette={palette} template={template} logoUrl={logoUrl}>
      {fotoFabrica ? (
        <Image src={fotoFabrica} style={{ width: "100%", height: 160, objectFit: "cover", marginBottom: 12 }} />
      ) : null}
      {paragrafos.map((p, i) => (
        <Text key={i} style={{ marginBottom: 8 }}>{p}</Text>
      ))}
      {diferenciais.length > 0 && (
        <>
          <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 10 }} />
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 6 }}>
            Nossos diferenciais
          </Text>
          {diferenciais.map((d, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.titulo}</Text>
              {d.descricao ? (
                <Text style={{ fontSize: 9, color: palette.textMuted }}>{d.descricao}</Text>
              ) : null}
            </View>
          ))}
        </>
      )}
    </StandardPage>
  );
}

export function CasesPage({ palette, template, logoUrl }: PageCtx) {
  const cases = (template?.cases_itens ?? []) as TemplateCaseItem[];
  const clientes = (template?.clientes_lista ?? []) as string[];
  return (
    <StandardPage title={template?.cases_titulo || "Cases / Projetos"} palette={palette} template={template} logoUrl={logoUrl}>
      {template?.cases_subtitulo ? (
        <Text style={{ marginBottom: 10, color: palette.textMuted }}>{template.cases_subtitulo}</Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {cases.map((c, i) => (
          <View key={i} style={{ width: "48%", marginBottom: 6, padding: 6, backgroundColor: palette.bgSoft, borderRadius: 3 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: palette.primary }}>
              {c.titulo}
            </Text>
            {c.cliente ? (
              <Text style={{ fontSize: 8, color: palette.textMuted }}>{c.cliente}</Text>
            ) : null}
            {c.descricao ? (
              <Text style={{ fontSize: 8, marginTop: 2 }}>{c.descricao}</Text>
            ) : null}
          </View>
        ))}
      </View>
      {clientes.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 6 }}>
            {template?.clientes_titulo || "Clientes que confiam na CN Cold"}
          </Text>
          <Text style={{ fontSize: 9, color: palette.textMuted }}>
            {clientes.join(" · ")}
          </Text>
        </View>
      )}
    </StandardPage>
  );
}

export function SolutionPage({ palette, template, logoUrl, solution }: PageCtx & { solution: SolutionData }) {
  return (
    <StandardPage title="Solução Proposta" palette={palette} template={template} logoUrl={logoUrl}>
      {solution.intro ? <Text style={{ marginBottom: 8 }}>{solution.intro}</Text> : null}
      {solution.contempla && solution.contempla.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 6 }}>O que contempla</Text>
          {solution.contempla.map((c, i) => (<Bullet key={i} palette={palette}>{c}</Bullet>))}
        </>
      )}
      {solution.diferenciais && solution.diferenciais.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 6, marginTop: 10 }}>Diferenciais</Text>
          {solution.diferenciais.map((c, i) => (<Bullet key={i} palette={palette}>{c}</Bullet>))}
        </>
      )}
      {solution.impacto && solution.impacto.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 6, marginTop: 10 }}>Impacto esperado</Text>
          {solution.impacto.map((c, i) => (<Bullet key={i} palette={palette}>{c}</Bullet>))}
        </>
      )}
      {solution.conclusao ? (
        <>
          <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 10 }} />
          <Text>{solution.conclusao}</Text>
        </>
      ) : null}
    </StandardPage>
  );
}

function InfoRow({ palette, label, value }: { palette: PdfPalette; label: string; value?: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      <Text style={{ width: 110, color: palette.textMuted, fontSize: 9 }}>{label}</Text>
      <Text style={{ flex: 1 }}>{value || "—"}</Text>
    </View>
  );
}

export function ContextPage({ palette, template, logoUrl, ctx }: PageCtx & { ctx: ContextData }) {
  return (
    <StandardPage title="Contextualização" palette={palette} template={template} logoUrl={logoUrl}>
      <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 6 }}>Cliente</Text>
      <InfoRow palette={palette} label="Razão social" value={ctx.cliente_razao} />
      <InfoRow palette={palette} label="Nome fantasia" value={ctx.fantasia} />
      <InfoRow palette={palette} label="CNPJ" value={ctx.cnpj} />
      <InfoRow palette={palette} label="Endereço" value={ctx.endereco} />

      {ctx.contatos && ctx.contatos.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 6, marginTop: 12 }}>Contatos</Text>
          {ctx.contatos.map((c, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{c.nome} {c.cargo ? `· ${c.cargo}` : ""}</Text>
              <Text style={{ fontSize: 9, color: palette.textMuted }}>
                {[c.email, c.telefone].filter(Boolean).join(" · ") || "—"}
              </Text>
            </View>
          ))}
        </>
      )}

      {ctx.caracteristicas && ctx.caracteristicas.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 6, marginTop: 12 }}>Características do projeto</Text>
          {ctx.caracteristicas.map((c, i) => (<Bullet key={i} palette={palette}>{c}</Bullet>))}
        </>
      )}

      {ctx.texto_apresentacao ? (
        <>
          <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 10 }} />
          <Text>{ctx.texto_apresentacao}</Text>
        </>
      ) : null}
      {ctx.prazo_validade ? (
        <Text style={{ fontSize: 9, color: palette.textMuted, marginTop: 8 }}>{ctx.prazo_validade}</Text>
      ) : null}
    </StandardPage>
  );
}

export function ScopePage({ palette, template, logoUrl, items }: PageCtx & { items: ScopeItem[] }) {
  const total = items.reduce((s, it) => s + (it.valor_total ?? 0), 0);
  return (
    <StandardPage title="Investimento" palette={palette} template={template} logoUrl={logoUrl}>
      {items.length === 0 ? (
        <Text>Nenhum item informado.</Text>
      ) : (
        <View style={{ borderWidth: 1, borderColor: palette.border, marginTop: 6 }}>
          <View style={{ flexDirection: "row", backgroundColor: palette.primary }}>
            <Text style={{ flex: 0.4, padding: 6, fontSize: 9, color: palette.white, fontFamily: "Helvetica-Bold" }}>#</Text>
            <Text style={{ flex: 4, padding: 6, fontSize: 9, color: palette.white, fontFamily: "Helvetica-Bold" }}>Descrição</Text>
            <Text style={{ flex: 1, padding: 6, fontSize: 9, color: palette.white, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Qtd</Text>
            <Text style={{ flex: 1.5, padding: 6, fontSize: 9, color: palette.white, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Unitário</Text>
            <Text style={{ flex: 1.5, padding: 6, fontSize: 9, color: palette.white, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Total</Text>
          </View>
          {items.map((it, i) => (
            <View key={it.id ?? i} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: palette.border }} wrap={false}>
              <Text style={{ flex: 0.4, padding: 6, fontSize: 9 }}>{i + 1}</Text>
              <View style={{ flex: 4, padding: 6 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>{it.titulo}</Text>
                {it.descricao ? <Text style={{ fontSize: 8, color: palette.textMuted }}>{it.descricao}</Text> : null}
              </View>
              <Text style={{ flex: 1, padding: 6, fontSize: 9, textAlign: "right" }}>{it.quantidade ?? "—"} {it.unidade || ""}</Text>
              <Text style={{ flex: 1.5, padding: 6, fontSize: 9, textAlign: "right" }}>{fmtBRL(it.valor_unitario)}</Text>
              <Text style={{ flex: 1.5, padding: 6, fontSize: 9, textAlign: "right" }}>{fmtBRL(it.valor_total)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", backgroundColor: palette.bgSoft, padding: 8, justifyContent: "flex-end" }}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: palette.primary, fontSize: 11 }}>
              Total geral: {fmtBRL(total)}
            </Text>
          </View>
        </View>
      )}
    </StandardPage>
  );
}

export function WarrantyPage({ palette, template, logoUrl, text }: PageCtx & { text: { html?: string; text?: string } }) {
  const body = text.text || template?.garantia_texto || "Garantia integral conforme contrato.";
  const items = (template?.garantia_itens ?? []) as TemplateGarantiaItem[];
  return (
    <StandardPage title="Prazo e Garantia" palette={palette} template={template} logoUrl={logoUrl}>
      {template?.prazo_entrega_padrao ? (
        <View style={{ marginBottom: 12, padding: 10, backgroundColor: palette.bgSoft, borderRadius: 3 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 4 }}>Prazo de entrega</Text>
          <Text>{template.prazo_entrega_padrao}</Text>
        </View>
      ) : null}
      <Text style={{ marginBottom: 8 }}>{body}</Text>
      {items.length > 0 && (
        <>
          <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 10 }} />
          {items.map((it, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{it.titulo}</Text>
              {it.descricao ? <Text style={{ fontSize: 9, color: palette.textMuted }}>{it.descricao}</Text> : null}
            </View>
          ))}
        </>
      )}
    </StandardPage>
  );
}

export function CustomRichPage({ palette, template, logoUrl, title, html }: PageCtx & { title: string; html?: string }) {
  const plain = html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  return (
    <StandardPage title={title} palette={palette} template={template} logoUrl={logoUrl}>
      {plain ? <Text>{plain}</Text> : <Text style={{ fontSize: 9, color: palette.textMuted }}>Página em branco.</Text>}
    </StandardPage>
  );
}
