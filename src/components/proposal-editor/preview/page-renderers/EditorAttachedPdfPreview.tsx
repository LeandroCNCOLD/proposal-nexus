import * as React from "react";

type Props = {
  title?: string;
  pdfPaths: string[];
  palette: any;
};

export function EditorAttachedPdfPreview({
  title = "Anexos da proposta",
  pdfPaths,
  palette,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: palette.primary }}>
        {title}
      </h2>
      {pdfPaths.length === 0 ? (
        <div className="text-sm" style={{ color: palette.muted }}>
          Nenhum PDF anexo vinculado.
        </div>
      ) : (
        <div className="space-y-2">
          {pdfPaths.map((path, index) => (
            <div
              key={`${path}-${index}`}
              className="rounded-md border px-4 py-3 text-sm"
              style={{ borderColor: palette.border, color: palette.text }}
            >
              {index + 1}. {path.split("/").pop() || `Anexo ${index + 1}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
