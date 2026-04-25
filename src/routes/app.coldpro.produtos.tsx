import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { ArrowLeft, Download, FileUp, Loader2, PackageSearch, Pencil, Plus, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  importColdProCatalogProducts,
  listColdProProductCatalog,
  upsertColdProCatalogProduct,
} from "@/features/coldpro/product-catalog.functions";

export const Route = createFileRoute("/app/coldpro/produtos")({ component: ColdProProductsPage });

type ProductForm = {
  id?: string;
  name: string;
  category: string | null;
  initial_freezing_temp_c: number | null;
  specific_heat_above_kcal_kg_c: number;
  specific_heat_below_kcal_kg_c: number;
  latent_heat_kcal_kg: number;
  density_kg_m3: number | null;
  water_content_percent: number | null;
  thermal_conductivity_unfrozen_w_m_k: number | null;
  thermal_conductivity_frozen_w_m_k: number | null;
  frozen_water_fraction: number | null;
  freezable_water_content_percent: number | null;
  characteristic_thickness_m: number | null;
  default_convective_coefficient_w_m2_k: number | null;
  allow_phase_change: boolean;
  respiration_rate_0c_w_kg: number | null;
  respiration_rate_5c_w_kg: number | null;
  respiration_rate_10c_w_kg: number | null;
  respiration_rate_15c_w_kg: number | null;
  respiration_rate_20c_w_kg: number | null;
  source: string | null;
  source_reference: string | null;
  is_ashrae_reference: boolean;
  data_confidence: string;
};

const emptyProduct: ProductForm = {
  name: "",
  category: "",
  initial_freezing_temp_c: null,
  specific_heat_above_kcal_kg_c: 0,
  specific_heat_below_kcal_kg_c: 0,
  latent_heat_kcal_kg: 0,
  density_kg_m3: null,
  water_content_percent: null,
  thermal_conductivity_unfrozen_w_m_k: null,
  thermal_conductivity_frozen_w_m_k: null,
  frozen_water_fraction: null,
  freezable_water_content_percent: null,
  characteristic_thickness_m: null,
  default_convective_coefficient_w_m2_k: null,
  allow_phase_change: true,
  respiration_rate_0c_w_kg: null,
  respiration_rate_5c_w_kg: null,
  respiration_rate_10c_w_kg: null,
  respiration_rate_15c_w_kg: null,
  respiration_rate_20c_w_kg: null,
  source: "ASHRAE",
  source_reference: "",
  is_ashrae_reference: true,
  data_confidence: "manual",
};

const columns: Array<{ key: keyof ProductForm; label: string }> = [
  { key: "category", label: "Grupo" },
  { key: "name", label: "Produto" },
  { key: "initial_freezing_temp_c", label: "Temp. cong. inicial °C" },
  { key: "specific_heat_above_kcal_kg_c", label: "Calor esp. acima kcal/kg°C" },
  { key: "specific_heat_below_kcal_kg_c", label: "Calor esp. abaixo kcal/kg°C" },
  { key: "latent_heat_kcal_kg", label: "Calor latente kcal/kg" },
  { key: "density_kg_m3", label: "Densidade kg/m³" },
  { key: "water_content_percent", label: "Água %" },
  { key: "thermal_conductivity_unfrozen_w_m_k", label: "Cond. não cong. W/mK" },
  { key: "thermal_conductivity_frozen_w_m_k", label: "Cond. cong. W/mK" },
  { key: "frozen_water_fraction", label: "Fração água cong." },
  { key: "freezable_water_content_percent", label: "Água congelável %" },
  { key: "characteristic_thickness_m", label: "Espessura caract. m" },
  { key: "default_convective_coefficient_w_m2_k", label: "h convectivo W/m²K" },
  { key: "allow_phase_change", label: "Mudança de fase" },
  { key: "respiration_rate_0c_w_kg", label: "Resp. 0°C W/kg" },
  { key: "respiration_rate_5c_w_kg", label: "Resp. 5°C W/kg" },
  { key: "respiration_rate_10c_w_kg", label: "Resp. 10°C W/kg" },
  { key: "respiration_rate_15c_w_kg", label: "Resp. 15°C W/kg" },
  { key: "respiration_rate_20c_w_kg", label: "Resp. 20°C W/kg" },
  { key: "source", label: "Fonte" },
  { key: "source_reference", label: "Referência" },
  { key: "is_ashrae_reference", label: "Referência Ashrae" },
  { key: "data_confidence", label: "Confiança" },
];

function keyOf(row: Pick<ProductForm, "name" | "category">) {
  return `${normalize(row.category)}::${normalize(row.name)}`;
}

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toBool(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["sim", "true", "1", "yes"].includes(normalize(value));
}

function rowToProduct(raw: Record<string, unknown>): ProductForm | null {
  const byLabel = new Map(columns.map((c) => [normalize(c.label), c.key]));
  const product = { ...emptyProduct };
  for (const [header, value] of Object.entries(raw)) {
    const key = byLabel.get(normalize(header)) ?? (normalize(header) as keyof ProductForm);
    if (!(key in product)) continue;
    if (key === "name" || key === "category" || key === "source" || key === "source_reference" || key === "data_confidence") {
      product[key] = String(value ?? "").trim() as never;
    } else if (key === "allow_phase_change" || key === "is_ashrae_reference") {
      product[key] = toBool(value) as never;
    } else {
      product[key] = toNumber(value) as never;
    }
  }
  return product.name.trim() ? product : null;
}

function ColdProProductsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [preview, setPreview] = useState<Array<ProductForm & { action: "update" | "create" }>>([]);

  const productsQuery = useQuery({ queryKey: ["coldpro-products-catalog"], queryFn: () => listColdProProductCatalog() });
  const saveMutation = useMutation({
    mutationFn: (product: ProductForm) => upsertColdProCatalogProduct({ data: product }),
    onSuccess: async () => {
      toast.success("Produto salvo.");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["coldpro-products-catalog"] });
    },
  });
  const importMutation = useMutation({
    mutationFn: (products: ProductForm[]) => importColdProCatalogProducts({ data: { products } }),
    onSuccess: async (out) => {
      toast.success(`Tabela aplicada: ${out.created} novos e ${out.updated} atualizados.`);
      setPreview([]);
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: ["coldpro-products-catalog"] });
    },
  });

  const products = (productsQuery.data ?? []) as ProductForm[];
  const existingKeys = useMemo(() => new Set(products.map(keyOf)), [products]);
  const filtered = products.filter((product) => {
    const q = normalize(search);
    return !q || normalize(product.name).includes(q) || normalize(product.category).includes(q);
  });

  function exportProducts() {
    const rows = products.map((product) => Object.fromEntries(columns.map((c) => [c.label, product[c.key] ?? ""])));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Produtos Ashrae");
    XLSX.writeFile(wb, "produtos-ashrae-coldpro.xlsx");
  }

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const parsed = rows.map(rowToProduct).filter(Boolean) as ProductForm[];
    const unique = Array.from(new Map(parsed.map((product) => [keyOf(product), product])).values());
    setPreview(unique.map((product) => ({ ...product, action: existingKeys.has(keyOf(product)) ? "update" : "create" })));
    toast.success(`Prévia gerada: ${unique.length} produtos. Nada foi gravado ainda.`);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/app/coldpro" className="flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> ColdPro</Link>
            <span>/</span><span>Produtos Ashrae</span>
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight"><PackageSearch className="h-6 w-6 text-primary" /> Tabela de produtos Ashrae</h1>
          <p className="text-sm text-muted-foreground">Baixe, revise, inclua, edite e aplique atualizações no grupo correto.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportProducts}><Download className="mr-2 h-4 w-4" />Baixar tabela</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Upload atualizado</Button>
          <Button onClick={() => setEditing({ ...emptyProduct })}><Plus className="mr-2 h-4 w-4" />Inserir</Button>
        </div>
      </div>

      {preview.length > 0 && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold">Revisão do upload</h2><p className="text-sm text-muted-foreground">Confira antes de gravar. Produtos existentes serão atualizados; novos serão inseridos.</p></div>
            <div className="flex gap-2"><Button variant="ghost" onClick={() => setPreview([])}>Cancelar</Button><Button disabled={importMutation.isPending} onClick={() => importMutation.mutate(preview)}>{importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aplicar importação</Button></div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm"><Badge variant="secondary">{preview.filter((p) => p.action === "update").length} atualizações</Badge><Badge>{preview.filter((p) => p.action === "create").length} novos</Badge></div>
          <div className="max-h-72 overflow-auto rounded-md border"><PreviewTable rows={preview.slice(0, 80)} /></div>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por produto ou grupo..." /></div>
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Grupo</TableHead><TableHead>Produto</TableHead><TableHead>Cong.</TableHead><TableHead>Calor esp.</TableHead><TableHead>Latente</TableHead><TableHead>Densidade</TableHead><TableHead>Fonte</TableHead><TableHead className="w-20">Editar</TableHead></TableRow></TableHeader>
            <TableBody>
              {productsQuery.isLoading ? <TableRow><TableCell colSpan={8}>Carregando...</TableCell></TableRow> : filtered.map((product) => (
                <TableRow key={product.id ?? `${product.category}-${product.name}`}>
                  <TableCell><Badge variant="outline">{product.category || "Sem grupo"}</Badge></TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.initial_freezing_temp_c ?? "—"} °C</TableCell>
                  <TableCell>{product.specific_heat_above_kcal_kg_c} / {product.specific_heat_below_kcal_kg_c}</TableCell>
                  <TableCell>{product.latent_heat_kcal_kg}</TableCell>
                  <TableCell>{product.density_kg_m3 ?? "—"}</TableCell>
                  <TableCell>{product.source ?? "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => setEditing({ ...emptyProduct, ...product })}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ProductDialog product={editing} onOpenChange={(open) => !open && setEditing(null)} onSave={(product) => saveMutation.mutate(product)} saving={saveMutation.isPending} />
    </div>
  );
}

function PreviewTable({ rows }: { rows: Array<ProductForm & { action: "update" | "create" }> }) {
  return <Table><TableHeader><TableRow><TableHead>Ação</TableHead><TableHead>Grupo</TableHead><TableHead>Produto</TableHead><TableHead>Temp.</TableHead><TableHead>Latente</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={`${row.category}-${row.name}`}><TableCell><Badge variant={row.action === "create" ? "default" : "secondary"}>{row.action === "create" ? "Novo" : "Atualizar"}</Badge></TableCell><TableCell>{row.category || "Sem grupo"}</TableCell><TableCell>{row.name}</TableCell><TableCell>{row.initial_freezing_temp_c ?? "—"}</TableCell><TableCell>{row.latent_heat_kcal_kg}</TableCell></TableRow>)}</TableBody></Table>;
}

function ProductDialog({ product, onOpenChange, onSave, saving }: { product: ProductForm | null; onOpenChange: (open: boolean) => void; onSave: (product: ProductForm) => void; saving: boolean }) {
  const [form, setForm] = useState<ProductForm>(product ?? emptyProduct);
  if (product && form.id !== product.id && form.name !== product.name) setForm(product);
  const text = (key: keyof ProductForm) => ({ value: String(form[key] ?? ""), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value || null }) });
  const num = (key: keyof ProductForm) => ({ value: form[key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value === "" ? null : Number(e.target.value) }) });
  return <Dialog open={!!product} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{product?.id ? "Editar produto" : "Inserir produto"}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-3"><Field label="Produto"><Input {...text("name")} /></Field><Field label="Grupo"><Input {...text("category")} /></Field><Field label="Fonte"><Input {...text("source")} /></Field>{columns.slice(2, 20).map((c) => c.key === "allow_phase_change" ? <Field key={c.key} label={c.label}><Switch checked={form.allow_phase_change} onCheckedChange={(checked) => setForm({ ...form, allow_phase_change: checked })} /></Field> : <Field key={c.key} label={c.label}><Input type="number" step="any" {...num(c.key)} /></Field>)}<Field label="Referência"><Input {...text("source_reference")} /></Field><Field label="Referência Ashrae"><Switch checked={form.is_ashrae_reference} onCheckedChange={(checked) => setForm({ ...form, is_ashrae_reference: checked })} /></Field><Field label="Confiança"><Input {...text("data_confidence")} /></Field></div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving || !form.name.trim()} onClick={() => onSave(form)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}