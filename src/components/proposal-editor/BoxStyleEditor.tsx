// Editor visual de "caixa" para blocos: fundo (transparente, sólido, gradiente),
// opacidade, raio das bordas, espessura/cor/estilo da borda.
// Aplica-se a `block.data.layout` e é refletido no editor e no PDF.
import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Paintbrush } from "lucide-react";
import type { BlockLayout } from "@/integrations/proposal-editor/types";

interface Props {
  layout: BlockLayout | undefined;
  onChange: (next: BlockLayout) => void;
}

const DEFAULTS = {
  bgMode: "none" as const,
  bgColor: "#ffffff",
  bgGradientFrom: "#3b82f6",
  bgGradientTo: "#0c2340",
  bgGradientAngle: 135,
  bgOpacity: 100,
  borderRadius: 8,
  borderWidth: 0,
  borderColor: "#cbd5e1",
  borderStyle: "solid" as const,
};

export function BoxStyleEditor({ layout, onChange }: Props) {
  const L = layout ?? ({ x: 0, y: 0, w: 0, h: 0 } as BlockLayout);
  const merged = { ...DEFAULTS, ...L };

  // Modo inicial inferido: se já houver bgMode usa, senão deduz do legado
  const initialMode = useMemo<"none" | "solid" | "gradient">(() => {
    if (L.bgMode) return L.bgMode;
    if (L.background === "white") return "solid";
    return "none";
  }, [L.bgMode, L.background]);

  const update = (patch: Partial<BlockLayout>) => onChange({ ...L, ...patch });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-1.5 text-[10px]"
          title="Editor de caixa: fundo, borda, opacidade"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Paintbrush className="h-3 w-3" />
          Caixa
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="z-[60] w-80 space-y-3 p-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Tabs
          defaultValue={initialMode}
          onValueChange={(v) => {
            const mode = v as "none" | "solid" | "gradient";
            update({
              bgMode: mode,
              // sincroniza o legado para manter compatibilidade
              background: mode === "none" ? "transparent" : "white",
            });
          }}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="none" className="text-[10px]">
              ◌ Transparente
            </TabsTrigger>
            <TabsTrigger value="solid" className="text-[10px]">
              ▭ Sólido
            </TabsTrigger>
            <TabsTrigger value="gradient" className="text-[10px]">
              ◐ Gradiente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="none" className="pt-2">
            <p className="text-[10px] text-muted-foreground">
              Sem fundo. Apenas o conteúdo aparecerá (no editor e no PDF).
            </p>
          </TabsContent>

          <TabsContent value="solid" className="space-y-2 pt-2">
            <Field label="Cor de fundo">
              <ColorInput
                value={merged.bgColor}
                onChange={(c) => update({ bgColor: c, bgMode: "solid" })}
              />
            </Field>
          </TabsContent>

          <TabsContent value="gradient" className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="De">
                <ColorInput
                  value={merged.bgGradientFrom}
                  onChange={(c) => update({ bgGradientFrom: c, bgMode: "gradient" })}
                />
              </Field>
              <Field label="Para">
                <ColorInput
                  value={merged.bgGradientTo}
                  onChange={(c) => update({ bgGradientTo: c, bgMode: "gradient" })}
                />
              </Field>
            </div>
            <Field label={`Ângulo: ${merged.bgGradientAngle}°`}>
              <Slider
                value={[merged.bgGradientAngle]}
                min={0}
                max={360}
                step={5}
                onValueChange={([v]) => update({ bgGradientAngle: v, bgMode: "gradient" })}
              />
            </Field>
          </TabsContent>
        </Tabs>

        {/* Opacidade do fundo */}
        <Field label={`Opacidade do fundo: ${merged.bgOpacity}%`}>
          <Slider
            value={[merged.bgOpacity]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => update({ bgOpacity: v })}
          />
        </Field>

        <div className="border-t pt-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Borda
          </p>
          <Field label={`Raio: ${merged.borderRadius}px`}>
            <Slider
              value={[merged.borderRadius]}
              min={0}
              max={48}
              step={1}
              onValueChange={([v]) => update({ borderRadius: v })}
            />
          </Field>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label={`Espessura: ${merged.borderWidth}px`}>
              <Slider
                value={[merged.borderWidth]}
                min={0}
                max={8}
                step={1}
                onValueChange={([v]) => update({ borderWidth: v })}
              />
            </Field>
            <Field label="Cor da borda">
              <ColorInput
                value={merged.borderColor}
                onChange={(c) => update({ borderColor: c })}
              />
            </Field>
          </div>
          <div className="mt-2 flex gap-1">
            {(["solid", "dashed", "dotted"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={merged.borderStyle === s ? "default" : "outline"}
                className="h-6 flex-1 text-[10px]"
                onClick={() => update({ borderStyle: s })}
              >
                {s === "solid" ? "Sólida" : s === "dashed" ? "Tracejada" : "Pontilhada"}
              </Button>
            ))}
          </div>
        </div>

        {/* Predefinições rápidas */}
        <div className="border-t pt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Predefinições
          </p>
          <div className="grid grid-cols-2 gap-1">
            <PresetButton
              label="Limpar"
              onClick={() =>
                update({
                  bgMode: "none",
                  bgOpacity: 100,
                  borderWidth: 0,
                  borderRadius: 8,
                  background: "transparent",
                })
              }
            />
            <PresetButton
              label="Card branco"
              onClick={() =>
                update({
                  bgMode: "solid",
                  bgColor: "#ffffff",
                  bgOpacity: 100,
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  borderRadius: 8,
                  background: "white",
                })
              }
            />
            <PresetButton
              label="Vidro"
              onClick={() =>
                update({
                  bgMode: "solid",
                  bgColor: "#ffffff",
                  bgOpacity: 60,
                  borderWidth: 1,
                  borderColor: "#ffffff",
                  borderRadius: 12,
                  background: "white",
                })
              }
            />
            <PresetButton
              label="Gradiente azul"
              onClick={() =>
                update({
                  bgMode: "gradient",
                  bgGradientFrom: "#3b82f6",
                  bgGradientTo: "#0c2340",
                  bgGradientAngle: 135,
                  bgOpacity: 100,
                  borderRadius: 12,
                  background: "white",
                })
              }
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 flex-1 font-mono text-[10px]"
      />
    </div>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={onClick}>
      {label}
    </Button>
  );
}

// Utilitários puros foram movidos para `@/integrations/proposal-editor/box-style`
// para que o pipeline de PDF não importe componentes React (Popover/Slider).
export { layoutToBoxStyle, layoutToPdfBoxStyle } from "@/integrations/proposal-editor/box-style";
