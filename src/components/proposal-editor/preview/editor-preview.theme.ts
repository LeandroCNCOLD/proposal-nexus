export type EditorPreviewPalette = {
  primary: string;
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  border: string;
};

export function buildEditorPreviewPalette(template?: any): EditorPreviewPalette {
  const colors = template?.colors ?? {};
  return {
    primary: colors.primary ?? "#0F4C81",
    accent: colors.accent ?? "#1D8348",
    accent2: colors.accent2 ?? "#D4AC0D",
    text: "#111827",
    muted: "#6B7280",
    border: "#D9E1EC",
  };
}
