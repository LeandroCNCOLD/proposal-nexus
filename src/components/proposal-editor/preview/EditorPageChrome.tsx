import * as React from "react";

type Props = {
  primaryColor: string;
  secondaryColor?: string;
  companyName?: string;
  proposalNumber?: string | null;
  pageNumber?: number;
};

export function EditorPageHeader({
  primaryColor,
  secondaryColor,
  companyName,
  proposalNumber,
}: Props) {
  return (
    <div
      className="flex items-center justify-between px-10 py-4 text-white"
      style={{
        background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor || primaryColor})`,
      }}
    >
      <div>
        <div className="text-sm font-semibold">{companyName || "CN COLD"}</div>
        <div className="text-xs opacity-90">Proposta técnica e comercial</div>
      </div>
      <div className="text-right text-xs opacity-95">
        <div>{proposalNumber ? `Proposta ${proposalNumber}` : "Documento técnico"}</div>
      </div>
    </div>
  );
}

export function EditorPageFooter({ primaryColor, pageNumber }: Props) {
  return (
    <div className="flex items-center justify-between px-10 py-3 text-xs text-slate-600">
      <div className="font-medium" style={{ color: primaryColor }}>
        CN COLD
      </div>
      <div>Página {pageNumber ?? 1}</div>
    </div>
  );
}
