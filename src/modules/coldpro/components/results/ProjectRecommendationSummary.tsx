type Props = {
  result: any;
};

type RecommendationKey =
  | "technicalSummary"
  | "recommendedEquipment"
  | "energySummary"
  | "risks"
  | "improvements"
  | "commercialArgument";

const BLOCKS: Array<{ title: string; key: RecommendationKey }> = [
  { title: "Resumo técnico", key: "technicalSummary" },
  { title: "Equipamento recomendado", key: "recommendedEquipment" },
  { title: "Energia", key: "energySummary" },
  { title: "Riscos", key: "risks" },
  { title: "Melhorias", key: "improvements" },
  { title: "Argumento comercial", key: "commercialArgument" },
];

function cleanItem(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === "NaN" || text === "undefined" || text === "Infinity" || text === "-Infinity") return null;
  return text;
}

function listItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanItem).filter((item): item is string => Boolean(item));
}

function RecommendationBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="leading-relaxed">{item}</li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground">—</div>
      )}
    </div>
  );
}

export function ProjectRecommendationSummary({ result }: Props) {
  const recommendation = result?.projectRecommendation ?? result?.recommendation ?? {};

  return (
    <div className="rounded-xl border bg-background p-3">
      <h3 className="mb-2 text-sm font-semibold">Recomendações técnicas</h3>
      <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {BLOCKS.map((block) => (
          <RecommendationBlock key={block.key} title={block.title} items={listItems(recommendation?.[block.key])} />
        ))}
      </div>
    </div>
  );
}