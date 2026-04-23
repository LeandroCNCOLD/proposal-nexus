import * as React from "react";

type Props = {
  title?: string;
  palette: any;
  deliveryText?: string | null;
  warrantyText?: string | null;
  noteText?: string | null;
};

function Block({
  title,
  text,
  palette,
}: {
  title: string;
  text: string;
  palette: any;
}) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: palette.border }}>
      <div className="mb-2 text-sm font-semibold" style={{ color: palette.primary }}>
        {title}
      </div>
      <div
        className="whitespace-pre-line text-sm leading-6"
        style={{ color: palette.text }}
      >
        {text}
      </div>
    </div>
  );
}

export function EditorBackCoverPreview({
  title = "Informações finais",
  palette,
  deliveryText,
  warrantyText,
  noteText,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: palette.primary }}>
        {title}
      </h2>
      {deliveryText ? (
        <Block title="Prazo de entrega" text={deliveryText} palette={palette} />
      ) : null}
      {warrantyText ? (
        <Block title="Garantia" text={warrantyText} palette={palette} />
      ) : null}
      {noteText ? <Block title="Nota" text={noteText} palette={palette} /> : null}
    </div>
  );
}
