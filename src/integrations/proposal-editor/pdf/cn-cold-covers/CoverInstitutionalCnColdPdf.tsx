/**
 * PDF — Capa 2 cover_institutional_cn_cold.
 */
import { Image, Text, View } from "@react-pdf/renderer";
import type { DocumentBlock } from "../../types";
import type { ProposalTemplate } from "../../template.types";

const PRIMARY = "#0c2340";

interface Ctx {
  template: ProposalTemplate | null;
  proposal?: {
    empresa_telefone?: string | null;
    empresa_email?: string | null;
    empresa_site?: string | null;
  };
}

const pickStr = (a: unknown, b?: string | null): string => {
  const s = typeof a === "string" ? a.trim() : "";
  if (s) return s;
  return (b ?? "").trim() || "—";
};

const DEFAULT_PARAGRAPHS = [
  "A CN Cold é especializada em sistemas de refrigeração industrial, com mais de duas décadas de experiência projetando, fabricando e instalando soluções térmicas para os mais diversos setores.",
  "Atuamos da engenharia conceitual à manutenção pós-venda, entregando equipamentos com alta eficiência energética e conformidade técnica.",
];

const DEFAULT_REASONS = [
  "Engenharia própria com cálculo termodinâmico certificado",
  "Fabricação nacional com controle total de qualidade",
  "Equipe técnica especializada em instalação e comissionamento",
  "Assistência técnica em todo território nacional",
];

export function CoverInstitutionalCnColdPdf(block: DocumentBlock, ctx: Ctx) {
  const data = block.data ?? {};
  const primary = (data.primary_color as string) || ctx.template?.primary_color || PRIMARY;
  const title = (data.title as string) || "Sobre a CN Cold";
  const slogan = (data.slogan as string) || "Engenharia que resfria. Confiança que aquece.";
  const paragraphs: string[] = Array.isArray(data.paragraphs)
    ? (data.paragraphs as string[])
    : DEFAULT_PARAGRAPHS;
  const reasons: string[] = Array.isArray(data.reasons)
    ? (data.reasons as string[])
    : DEFAULT_REASONS;
  const images: { url: string }[] = Array.isArray(data.images) ? (data.images as { url: string }[]) : [];
  const factory = images[0]?.url || (data.background_image as string) || "";
  const equip = images[1]?.url || "";

  const footer = (data.footer as Record<string, unknown> | undefined) ?? {};
  const tel = pickStr(footer.telefone, ctx.proposal?.empresa_telefone ?? ctx.template?.empresa_telefone);
  const email = pickStr(footer.email, ctx.proposal?.empresa_email ?? ctx.template?.empresa_email);
  const site = pickStr(footer.site, ctx.proposal?.empresa_site ?? ctx.template?.empresa_site);
  const cidade = pickStr(footer.cidade, ctx.template?.empresa_cidade);

  return (
    <View
      key={block.id}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#ffffff" }}
    >
      <View style={{ height: 4, backgroundColor: primary }} />

      <View style={{ flexDirection: "row", padding: 40, gap: 18 }}>
        {/* Esquerda */}
        <View style={{ flex: 1.4 }}>
          <Text style={{ fontSize: 26, color: primary, fontFamily: "Helvetica-Bold" }}>{title}</Text>
          <View style={{ width: 40, height: 3, backgroundColor: primary, marginTop: 6 }} />
          <View style={{ marginTop: 14, gap: 8 }}>
            {paragraphs.map((p, i) => (
              <Text key={i} style={{ fontSize: 10, color: "#334155", lineHeight: 1.5 }}>
                {p}
              </Text>
            ))}
          </View>

          <View
            style={{
              marginTop: 18,
              backgroundColor: "#f8fafc",
              borderWidth: 0.5,
              borderColor: "#e2e8f0",
              borderRadius: 6,
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 12, color: primary, fontFamily: "Helvetica-Bold", letterSpacing: 1 }}>
              POR QUE ESCOLHER A CN COLD?
            </Text>
            <View style={{ marginTop: 8, gap: 6 }}>
              {reasons.map((r, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 6 }}>
                  <Text style={{ color: primary, fontSize: 10 }}>●</Text>
                  <Text style={{ fontSize: 10, color: "#334155", flex: 1 }}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Direita */}
        <View style={{ flex: 1, gap: 10 }}>
          {factory ? (
            <Image src={factory} style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 4 }} />
          ) : (
            <View
              style={{
                width: "100%",
                height: 130,
                backgroundColor: "#f1f5f9",
                borderRadius: 4,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 8, color: "#94a3b8" }}>Imagem da fábrica</Text>
            </View>
          )}
          {equip ? (
            <Image src={equip} style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 4 }} />
          ) : (
            <View
              style={{
                width: "100%",
                height: 130,
                backgroundColor: "#f1f5f9",
                borderRadius: 4,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 8, color: "#94a3b8" }}>Linha de equipamentos</Text>
            </View>
          )}
          <View
            style={{
              backgroundColor: primary,
              borderRadius: 4,
              padding: 12,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: "#ffffff",
                fontFamily: "Helvetica-BoldOblique",
                textAlign: "center",
              }}
            >
              {slogan}
            </Text>
          </View>
        </View>
      </View>

      {/* rodapé */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: primary,
          paddingHorizontal: 40,
          paddingVertical: 16,
          flexDirection: "row",
          justifyContent: "space-between",
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
