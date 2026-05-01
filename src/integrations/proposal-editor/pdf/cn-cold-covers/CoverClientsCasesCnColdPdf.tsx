/**
 * PDF — Capa 3 cover_clients_cases_cn_cold.
 */
import { Image, Text, View } from "@react-pdf/renderer";
import type { DocumentBlock } from "../../types";
import type { ProposalTemplate } from "../../template.types";

const PRIMARY = "#0c2340";

interface Case {
  title: string;
  subtitle?: string;
  image_url?: string;
  featured?: boolean;
}

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

export function CoverClientsCasesCnColdPdf(block: DocumentBlock, ctx: Ctx) {
  const data = block.data ?? {};
  const primary = (data.primary_color as string) || ctx.template?.primary_color || PRIMARY;
  const title = (data.title as string) || "Soluções em Refrigeração Industrial";
  const subtitle =
    (data.subtitle as string) || "Engenharia • Fabricação • Instalação • Manutenção";
  const cases: Case[] = Array.isArray(data.cases) ? (data.cases as Case[]) : [];
  const logos: { url: string; name?: string }[] = Array.isArray(data.client_logos)
    ? (data.client_logos as { url: string; name?: string }[])
    : [];

  const featured = cases.find((c) => c.featured) ?? cases[0];
  const others = cases.filter((c) => c !== featured).slice(0, 4);

  const footer = (data.footer as Record<string, unknown> | undefined) ?? {};
  const tel = pickStr(footer.telefone, ctx.proposal?.empresa_telefone ?? ctx.template?.empresa_telefone);
  const email = pickStr(footer.email, ctx.proposal?.empresa_email ?? ctx.template?.empresa_email);
  const site = pickStr(footer.site, ctx.proposal?.empresa_site ?? ctx.template?.empresa_site);
  const cidade = pickStr(footer.cidade, ctx.template?.empresa_cidade);

  return (
    <View
      key={block.id}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#f8fafc" }}
    >
      <View style={{ height: 4, backgroundColor: primary }} />

      <View style={{ paddingHorizontal: 40, paddingTop: 32 }}>
        <Text style={{ fontSize: 24, color: primary, fontFamily: "Helvetica-Bold" }}>{title}</Text>
        <Text style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{subtitle}</Text>
        <View style={{ width: 50, height: 3, backgroundColor: primary, marginTop: 8 }} />
      </View>

      {/* Destaque + grid */}
      <View style={{ flexDirection: "row", paddingHorizontal: 40, marginTop: 18, gap: 14 }}>
        <View style={{ flex: 1.3, backgroundColor: "#ffffff", borderRadius: 6, overflow: "hidden" }}>
          {featured?.image_url ? (
            <Image
              src={featured.image_url}
              style={{ width: "100%", height: 160, objectFit: "cover" }}
            />
          ) : (
            <View
              style={{ width: "100%", height: 160, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 9, color: "#94a3b8" }}>Case em destaque</Text>
            </View>
          )}
          <View style={{ padding: 12 }}>
            <Text style={{ fontSize: 8, color: primary, letterSpacing: 1.2 }}>CASE EM DESTAQUE</Text>
            <Text style={{ fontSize: 14, color: "#0f172a", fontFamily: "Helvetica-Bold", marginTop: 4 }}>
              {featured?.title || "—"}
            </Text>
            {featured?.subtitle ? (
              <Text style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>{featured.subtitle}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {others.map((c, i) => (
            <View
              key={i}
              style={{
                width: "48%",
                backgroundColor: "#ffffff",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              {c.image_url ? (
                <Image src={c.image_url} style={{ width: "100%", height: 70, objectFit: "cover" }} />
              ) : (
                <View
                  style={{
                    width: "100%",
                    height: 70,
                    backgroundColor: "#e2e8f0",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 7, color: "#94a3b8" }}>Imagem</Text>
                </View>
              )}
              <Text style={{ fontSize: 9, color: "#0f172a", padding: 6, fontFamily: "Helvetica-Bold" }}>
                {c.title}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* logos */}
      <View style={{ paddingHorizontal: 40, marginTop: 22 }}>
        <Text style={{ fontSize: 9, color: primary, letterSpacing: 1.5, fontFamily: "Helvetica-Bold" }}>
          CLIENTES QUE CONFIAM NA CN COLD
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {logos.map((l, i) => (
            <View
              key={i}
              style={{
                width: "15%",
                height: 40,
                backgroundColor: "#ffffff",
                borderWidth: 0.5,
                borderColor: "#e2e8f0",
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
              }}
            >
              {l.url ? (
                <Image src={l.url} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <Text style={{ fontSize: 7, color: "#94a3b8" }}>{l.name || "logo"}</Text>
              )}
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 7, fontStyle: "italic", color: "#94a3b8", marginTop: 6 }}>
          Marcas e logotipos exibidos pertencem a seus respectivos titulares e são usados apenas para fins
          ilustrativos.
        </Text>
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
