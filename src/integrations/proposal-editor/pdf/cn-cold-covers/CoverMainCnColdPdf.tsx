/**
 * PDF — Capa 1 cover_main_cn_cold.
 * Renderiza no mesmo fluxo do BlockPdfRenderer, ocupando toda a página A4.
 * Recomendado: usar com page.hideHeader = page.hideFooter = true.
 */
import { Image, Text, View } from "@react-pdf/renderer";
import type { DocumentBlock } from "../../types";
import type { ProposalTemplate } from "../../template.types";

const PRIMARY = "#0c2340";
const PRIMARY_DARK = "#081a30";

interface RenderProposal {
  number?: string | null;
  title?: string | null;
  client_name?: string | null;
  created_at?: string | null;
  vendedor?: string | null;
  empresa_telefone?: string | null;
  empresa_email?: string | null;
  empresa_site?: string | null;
}

interface Ctx {
  template: ProposalTemplate | null;
  proposal?: RenderProposal;
}

const fmtDate = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

const pickStr = (a: unknown, b?: string | null): string => {
  const s = typeof a === "string" ? a.trim() : "";
  if (s) return s;
  return (b ?? "").trim() || "—";
};

export function CoverMainCnColdPdf(block: DocumentBlock, ctx: Ctx) {
  const data = block.data ?? {};
  const primary = (data.primary_color as string) || ctx.template?.primary_color || PRIMARY;
  const logo = (data.logo_url as string) || "";
  const title = (data.title as string) || "PROPOSTA TÉCNICA E COMERCIAL";
  const subtitle = (data.subtitle as string) || "Soluções em Refrigeração Industrial";
  const images: { url: string }[] = Array.isArray(data.images) ? (data.images as { url: string }[]) : [];

  const clientName = pickStr(data.client_name, ctx.proposal?.client_name);
  const projectTitle = pickStr(data.proposal_title, ctx.proposal?.title);
  const number = pickStr(data.proposal_number, ctx.proposal?.number);
  const date = pickStr(data.proposal_date, fmtDate(ctx.proposal?.created_at ?? null));
  const vendedor = pickStr(data.vendedor, ctx.proposal?.vendedor);

  const footer = (data.footer as Record<string, unknown> | undefined) ?? {};
  const tel = pickStr(footer.telefone, ctx.proposal?.empresa_telefone ?? ctx.template?.empresa_telefone);
  const email = pickStr(footer.email, ctx.proposal?.empresa_email ?? ctx.template?.empresa_email);
  const site = pickStr(footer.site, ctx.proposal?.empresa_site ?? ctx.template?.empresa_site);
  const cidade = pickStr(footer.cidade, ctx.template?.empresa_cidade);

  return (
    <View
      key={block.id}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: primary,
      }}
    >
      {/* faixa topo */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: "#1e90ff" }}
      />

      {/* header logo + nº */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 40,
          paddingTop: 40,
        }}
      >
        {logo ? (
          <Image src={logo} style={{ width: 100, height: 50, objectFit: "contain" }} />
        ) : (
          <View style={{ width: 100, height: 40, borderWidth: 1, borderColor: "#ffffff44" }} />
        )}
        <Text style={{ fontSize: 9, color: "#ffffff99", letterSpacing: 1.5 }}>
          Nº {number}
        </Text>
      </View>

      {/* título */}
      <View style={{ paddingHorizontal: 40, marginTop: 36 }}>
        <Text style={{ fontSize: 32, color: "#ffffff", fontFamily: "Helvetica-Bold", lineHeight: 1.15 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 14, color: "#ffffffcc", marginTop: 6 }}>{subtitle}</Text>
        <View style={{ width: 60, height: 3, backgroundColor: "#1e90ff", marginTop: 10 }} />
      </View>

      {/* corpo: caixa branca + grid imagens */}
      <View style={{ flexDirection: "row", paddingHorizontal: 40, marginTop: 36, gap: 16 }}>
        <View
          style={{
            flex: 2,
            backgroundColor: "#ffffff",
            borderRadius: 6,
            padding: 18,
            color: "#1f2937",
          }}
        >
          {[
            { l: "CLIENTE", v: clientName },
            { l: "PROJETO", v: projectTitle },
            { l: "Nº DA PROPOSTA", v: number },
            { l: "DATA", v: date },
            { l: "RESPONSÁVEL COMERCIAL", v: vendedor },
          ].map((it) => (
            <View
              key={it.l}
              style={{
                paddingVertical: 6,
                borderBottomWidth: 0.5,
                borderBottomColor: "#e2e8f0",
              }}
            >
              <Text style={{ fontSize: 7, color: "#64748b", letterSpacing: 1.2 }}>{it.l}</Text>
              <Text style={{ fontSize: 12, color: "#0f172a", marginTop: 2 }}>{it.v}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map((i) => {
            const url = images[i]?.url;
            return url ? (
              <Image
                key={i}
                src={url}
                style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 4 }}
              />
            ) : (
              <View
                key={i}
                style={{
                  width: "100%",
                  height: 90,
                  borderRadius: 4,
                  backgroundColor: "#ffffff15",
                  borderWidth: 0.5,
                  borderColor: "#ffffff33",
                }}
              />
            );
          })}
        </View>
      </View>

      {/* rodapé */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: PRIMARY_DARK,
          paddingHorizontal: 40,
          paddingVertical: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 9, color: "#ffffffcc" }}>
          {[
            tel !== "—" ? `Tel: ${tel}` : null,
            email !== "—" ? email : null,
            site !== "—" ? site : null,
            cidade !== "—" ? cidade : null,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>
        <Text style={{ fontSize: 8, color: "#ffffff77", letterSpacing: 1.5 }}>CN COLD</Text>
      </View>
    </View>
  );
}
