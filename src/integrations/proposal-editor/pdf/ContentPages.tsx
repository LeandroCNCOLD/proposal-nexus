import { Text, View } from "@react-pdf/renderer";
import { pdfStyles, colors } from "./styles";
import { StandardPage } from "./StandardPage";
import type { ContextData, ScopeItem, SolutionData } from "../types";

const fmtBRL = (n?: number) =>
  typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function Bullet({ children }: { children: string }) {
  return (
    <View style={pdfStyles.bullet}>
      <Text style={pdfStyles.bulletDot}>•</Text>
      <Text style={pdfStyles.bulletText}>{children}</Text>
    </View>
  );
}

export function AboutPage() {
  return (
    <StandardPage title="Sobre a CN Cold">
      <Text style={pdfStyles.paragraph}>
        A CN Cold é especializada em refrigeração industrial, com soluções completas para câmaras
        frigoríficas, túneis de congelamento, racks de compressores e sistemas de automação.
        Atuamos em todo o Brasil com projetos sob medida, equipe técnica própria e atendimento
        pós-venda.
      </Text>
      <Text style={pdfStyles.paragraph}>
        Nossa missão é entregar eficiência energética, confiabilidade operacional e o menor custo
        total de propriedade ao longo da vida útil do sistema.
      </Text>
      <View style={pdfStyles.divider} />
      <Text style={pdfStyles.h3}>Nossos pilares</Text>
      <Bullet>Engenharia própria com cálculo térmico detalhado</Bullet>
      <Bullet>Equipamentos de marcas líderes (Bitzer, Copeland, Danfoss)</Bullet>
      <Bullet>Comissionamento e treinamento da equipe operacional</Bullet>
      <Bullet>Manutenção preventiva e suporte 24x7</Bullet>
    </StandardPage>
  );
}

export function CasesPage() {
  return (
    <StandardPage title="Cases de sucesso">
      <Text style={pdfStyles.paragraph}>
        Mais de 200 projetos entregues nos setores de alimentos, frigoríficos, distribuidoras de
        congelados, indústria farmacêutica e logística refrigerada.
      </Text>
      <Bullet>Frigorífico de aves — câmara de 2.500 m³ a -25 °C</Bullet>
      <Bullet>Distribuidor de pescados — túnel de congelamento contínuo</Bullet>
      <Bullet>Laticínio — sala de processamento climatizada com controle de umidade</Bullet>
    </StandardPage>
  );
}

export function SolutionPage({ solution }: { solution: SolutionData }) {
  return (
    <StandardPage title="Nossa solução">
      {solution.intro ? <Text style={pdfStyles.paragraph}>{solution.intro}</Text> : null}

      {solution.contempla && solution.contempla.length > 0 && (
        <>
          <Text style={pdfStyles.h3}>O que contempla</Text>
          {solution.contempla.map((c, i) => (
            <Bullet key={i}>{c}</Bullet>
          ))}
        </>
      )}

      {solution.diferenciais && solution.diferenciais.length > 0 && (
        <>
          <Text style={[pdfStyles.h3, { marginTop: 10 }]}>Diferenciais</Text>
          {solution.diferenciais.map((c, i) => (
            <Bullet key={i}>{c}</Bullet>
          ))}
        </>
      )}

      {solution.impacto && solution.impacto.length > 0 && (
        <>
          <Text style={[pdfStyles.h3, { marginTop: 10 }]}>Impacto esperado</Text>
          {solution.impacto.map((c, i) => (
            <Bullet key={i}>{c}</Bullet>
          ))}
        </>
      )}

      {solution.conclusao ? (
        <>
          <View style={pdfStyles.divider} />
          <Text style={pdfStyles.paragraph}>{solution.conclusao}</Text>
        </>
      ) : null}
    </StandardPage>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      <Text style={{ width: 110, color: colors.textMuted, fontSize: 9 }}>{label}</Text>
      <Text style={{ flex: 1 }}>{value || "—"}</Text>
    </View>
  );
}

export function ContextPage({ ctx }: { ctx: ContextData }) {
  return (
    <StandardPage title="Contextualização">
      <Text style={pdfStyles.h3}>Cliente</Text>
      <InfoRow label="Razão social" value={ctx.cliente_razao} />
      <InfoRow label="Nome fantasia" value={ctx.fantasia} />
      <InfoRow label="CNPJ" value={ctx.cnpj} />
      <InfoRow label="Endereço" value={ctx.endereco} />

      {ctx.contatos && ctx.contatos.length > 0 && (
        <>
          <Text style={[pdfStyles.h3, { marginTop: 12 }]}>Contatos</Text>
          {ctx.contatos.map((c, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                {c.nome} {c.cargo ? `· ${c.cargo}` : ""}
              </Text>
              <Text style={pdfStyles.small}>
                {[c.email, c.telefone].filter(Boolean).join(" · ") || "—"}
              </Text>
            </View>
          ))}
        </>
      )}

      {ctx.caracteristicas && ctx.caracteristicas.length > 0 && (
        <>
          <Text style={[pdfStyles.h3, { marginTop: 12 }]}>Características do projeto</Text>
          {ctx.caracteristicas.map((c, i) => (
            <Bullet key={i}>{c}</Bullet>
          ))}
        </>
      )}

      {ctx.texto_apresentacao ? (
        <>
          <View style={pdfStyles.divider} />
          <Text style={pdfStyles.paragraph}>{ctx.texto_apresentacao}</Text>
        </>
      ) : null}

      {ctx.prazo_validade ? (
        <Text style={[pdfStyles.small, { marginTop: 8 }]}>{ctx.prazo_validade}</Text>
      ) : null}
    </StandardPage>
  );
}

export function ScopePage({ items }: { items: ScopeItem[] }) {
  const total = items.reduce((s, it) => s + (it.valor_total ?? 0), 0);
  return (
    <StandardPage title="Escopo de fornecimento">
      {items.length === 0 ? (
        <Text style={pdfStyles.paragraph}>Nenhum item informado.</Text>
      ) : (
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <Text style={[pdfStyles.tableCellHeader, { flex: 0.4 }]}>#</Text>
            <Text style={[pdfStyles.tableCellHeader, { flex: 4 }]}>Descrição</Text>
            <Text style={[pdfStyles.tableCellHeader, { flex: 1, textAlign: "right" }]}>Qtd</Text>
            <Text style={[pdfStyles.tableCellHeader, { flex: 1.5, textAlign: "right" }]}>
              Unitário
            </Text>
            <Text style={[pdfStyles.tableCellHeader, { flex: 1.5, textAlign: "right" }]}>Total</Text>
          </View>
          {items.map((it, i) => (
            <View key={it.id ?? i} style={pdfStyles.tableRow} wrap={false}>
              <Text style={[pdfStyles.tableCell, { flex: 0.4 }]}>{i + 1}</Text>
              <View style={[pdfStyles.tableCell, { flex: 4 }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{it.titulo}</Text>
                {it.descricao ? (
                  <Text style={{ fontSize: 8, color: colors.textMuted }}>{it.descricao}</Text>
                ) : null}
              </View>
              <Text style={[pdfStyles.tableCell, { flex: 1, textAlign: "right" }]}>
                {it.quantidade ?? "—"} {it.unidade || ""}
              </Text>
              <Text style={[pdfStyles.tableCell, { flex: 1.5, textAlign: "right" }]}>
                {fmtBRL(it.valor_unitario)}
              </Text>
              <Text style={[pdfStyles.tableCell, { flex: 1.5, textAlign: "right" }]}>
                {fmtBRL(it.valor_total)}
              </Text>
            </View>
          ))}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.bgSoft,
              padding: 6,
              justifyContent: "flex-end",
            }}
          >
            <Text style={{ fontFamily: "Helvetica-Bold", color: colors.primary }}>
              Total geral: {fmtBRL(total)}
            </Text>
          </View>
        </View>
      )}
    </StandardPage>
  );
}

export function WarrantyPage({ text }: { text: { html?: string; text?: string } }) {
  const body =
    text.text ||
    "A CN Cold garante os equipamentos fornecidos contra defeitos de fabricação por 12 meses a partir da data de comissionamento, incluindo peças e mão de obra técnica. A garantia cobre uso normal e operação dentro das especificações de projeto.";
  return (
    <StandardPage title="Garantia">
      <Text style={pdfStyles.paragraph}>{body}</Text>
      <View style={pdfStyles.divider} />
      <Text style={pdfStyles.h3}>Não cobre</Text>
      <Bullet>Danos por uso indevido ou fora das especificações de projeto</Bullet>
      <Bullet>Falta de manutenção preventiva conforme manual</Bullet>
      <Bullet>Intervenções de terceiros não autorizados</Bullet>
    </StandardPage>
  );
}

export function CustomRichPage({ title, html }: { title: string; html?: string }) {
  // Etapa 5 fará render rico de HTML; por ora, plain text
  const plain = html
    ? html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
  return (
    <StandardPage title={title}>
      {plain ? (
        <Text style={pdfStyles.paragraph}>{plain}</Text>
      ) : (
        <Text style={pdfStyles.small}>Página em branco.</Text>
      )}
    </StandardPage>
  );
}
