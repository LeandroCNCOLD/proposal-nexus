import { useRef, useState } from "react";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  uploadTemplateAsset,
  deleteTemplateAsset,
} from "@/integrations/proposal-editor/template.functions";
import type { TemplateAsset } from "@/integrations/proposal-editor/template.types";

interface FullPageImageUploaderProps {
  templateId: string;
  assetKind: "cover_full" | "about_full" | "clients_full" | "header_banner" | "footer_banner";
  title: string;
  description: string;
  current: TemplateAsset | undefined;
  /** Proporção do preview. Default 1:1.414 (A4). Use "banner" para faixas largas. */
  aspect?: "a4" | "banner";
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function FullPageImageUploader({
  templateId,
  assetKind,
  title,
  description,
  current,
}: FullPageImageUploaderProps) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return uploadTemplateAsset({
        data: {
          templateId,
          assetKind,
          fileName: file.name,
          mimeType: file.type || "image/png",
          base64,
          label: title,
        },
      });
    },
    onSuccess: () => {
      toast.success(`${title} atualizada`);
      qc.invalidateQueries({ queryKey: ["proposal-template", templateId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!current) return;
      await deleteTemplateAsset({ data: { assetId: current.id } });
    },
    onSuccess: () => {
      toast.success(`${title} removida`);
      qc.invalidateQueries({ queryKey: ["proposal-template", templateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagem maior que 8 MB. Reduza antes de enviar.");
      return;
    }
    setUploading(true);
    uploadMut.mutate(file);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1 h-4 w-4" />
            )}
            {current ? "Substituir" : "Enviar imagem"}
          </Button>
          {current && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      <div className="rounded-lg border bg-secondary/20 overflow-hidden">
        {current ? (
          <div className="aspect-[1/1.414] w-full max-w-sm mx-auto bg-white">
            <img
              src={current.url}
              alt={title}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="aspect-[1/1.414] w-full max-w-sm mx-auto flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ImageIcon className="h-10 w-10 opacity-40" />
            <p className="text-xs">Nenhuma imagem enviada</p>
            <p className="text-[10px] uppercase tracking-wide opacity-70">
              Proporção A4 (1:1.414)
            </p>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Formato recomendado: PNG ou JPG em A4 retrato (ex.: 1240 × 1754 px ou
        2480 × 3508 px). Quando enviada, esta imagem substitui o layout
        dinâmico desta página no PDF gerado.
      </p>
    </Card>
  );
}
