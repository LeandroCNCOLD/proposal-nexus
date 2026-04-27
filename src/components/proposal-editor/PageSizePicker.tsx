// Seletor de tamanho de página (A4, A3, Carta, Ofício, Personalizado em mm)
// e orientação (retrato/paisagem). Controlado.
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ruler } from "lucide-react";
import {
  PAGE_SIZE_LABELS,
  PAGE_SIZES_MM,
  type DocumentPageSize,
  type PageSizeId,
  type PageOrientation,
  makePageSize,
} from "@/integrations/proposal-editor/page-sizes";

interface Props {
  value: DocumentPageSize;
  onChange: (next: DocumentPageSize) => void;
}

export function PageSizePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customW, setCustomW] = useState<number>(value.id === "Custom" ? value.widthMm : 210);
  const [customH, setCustomH] = useState<number>(value.id === "Custom" ? value.heightMm : 297);

  const setSize = (id: PageSizeId) => {
    if (id === "Custom") {
      onChange(makePageSize("Custom", value.orientation, { w: customW, h: customH }));
      return;
    }
    onChange(makePageSize(id, value.orientation));
  };

  const setOrientation = (o: PageOrientation) => {
    onChange({ ...value, orientation: o });
  };

  const applyCustom = () => {
    onChange(makePageSize("Custom", value.orientation, { w: customW, h: customH }));
  };

  const label =
    value.id === "Custom"
      ? `Custom (${value.widthMm} × ${value.heightMm} mm)`
      : PAGE_SIZE_LABELS[value.id];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <Ruler className="h-3.5 w-3.5" />
          <span className="max-w-[160px] truncate">{label}</span>
          <span className="text-muted-foreground">
            · {value.orientation === "landscape" ? "Paisagem" : "Retrato"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] space-y-3 p-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Tamanho</Label>
          <Select value={value.id} onValueChange={(v) => setSize(v as PageSizeId)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PAGE_SIZE_LABELS) as PageSizeId[]).map((id) => (
                <SelectItem key={id} value={id} className="text-xs">
                  {PAGE_SIZE_LABELS[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Orientação</Label>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={value.orientation === "portrait" ? "default" : "outline"}
              className="h-7 flex-1 text-[11px]"
              onClick={() => setOrientation("portrait")}
            >
              Retrato
            </Button>
            <Button
              size="sm"
              variant={value.orientation === "landscape" ? "default" : "outline"}
              className="h-7 flex-1 text-[11px]"
              onClick={() => setOrientation("landscape")}
            >
              Paisagem
            </Button>
          </div>
        </div>

        {value.id === "Custom" ? (
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Dimensões personalizadas (mm)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={50}
                max={1500}
                value={customW}
                onChange={(e) => setCustomW(Number(e.target.value) || 0)}
                className="h-8 text-xs"
                placeholder="Largura"
              />
              <span className="text-xs text-muted-foreground">×</span>
              <Input
                type="number"
                min={50}
                max={1500}
                value={customH}
                onChange={(e) => setCustomH(Number(e.target.value) || 0)}
                className="h-8 text-xs"
                placeholder="Altura"
              />
              <Button size="sm" className="h-8 text-[11px]" onClick={applyCustom}>
                Aplicar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            {PAGE_SIZES_MM[value.id as Exclude<PageSizeId, "Custom">].w} ×{" "}
            {PAGE_SIZES_MM[value.id as Exclude<PageSizeId, "Custom">].h} mm
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
