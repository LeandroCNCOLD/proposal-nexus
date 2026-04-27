// Réguas em cm (topo + lateral esquerda) ao redor do papel A4 e grade opcional.
// Largura da régua = 18px. As réguas são puramente visuais (pointer-events:none),
// mas o botão "Grade" fica fora delas (no topo do canvas).
import { useMemo } from "react";

interface Props {
  pageW: number;
  pageH: number;
  /** Mostrar a grade sobre a página? */
  showGrid: boolean;
}

const RULER = 18; // px
// Conversão px → cm. A4 = 21cm × 29,7cm em 96dpi → 794×1123 px (aprox).
// O canvas usa 816×1056. Calibramos cm assumindo a largura da página = 21cm.
function pxPerCm(pageW: number) {
  return pageW / 21;
}

export function HorizontalRuler({ pageW }: { pageW: number }) {
  const ppc = pxPerCm(pageW);
  const totalCm = Math.ceil(pageW / ppc);
  const ticks = useMemo(() => {
    const arr: { x: number; label: string; major: boolean }[] = [];
    for (let cm = 0; cm <= totalCm; cm += 1) {
      arr.push({ x: cm * ppc, label: String(cm), major: true });
      // sub-marcação de 0.5cm
      const half = (cm + 0.5) * ppc;
      if (half <= pageW) arr.push({ x: half, label: "", major: false });
    }
    return arr;
  }, [pageW, ppc, totalCm]);

  return (
    <div
      className="pointer-events-none relative bg-slate-100 text-[8px] font-medium text-slate-500"
      style={{ width: pageW + RULER, height: RULER, marginLeft: -RULER }}
    >
      {/* Cantinho onde cruza com a régua vertical */}
      <div
        className="absolute left-0 top-0 border-b border-r border-slate-300 bg-slate-200"
        style={{ width: RULER, height: RULER }}
      />
      <div
        className="absolute top-0 border-b border-slate-300"
        style={{ left: RULER, width: pageW, height: RULER }}
      >
        {ticks.map((t, i) => (
          <div
            key={i}
            className="absolute top-0"
            style={{ left: t.x, height: RULER }}
          >
            <div
              className="bg-slate-400"
              style={{ width: 1, height: t.major ? 8 : 4, marginTop: t.major ? 4 : 6 }}
            />
            {t.major ? (
              <span className="absolute -translate-x-1/2 select-none" style={{ top: 0, left: 0 }}>
                {t.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerticalRuler({ pageH }: { pageH: number }) {
  // Usamos a mesma escala da horizontal para consistência visual.
  // Como não temos pageW aqui, derivamos pelo A4: pageH ≈ 1056 ↔ 29.7cm
  const ppc = pageH / 29.7;
  const totalCm = Math.ceil(pageH / ppc);
  const ticks = useMemo(() => {
    const arr: { y: number; label: string; major: boolean }[] = [];
    for (let cm = 0; cm <= totalCm; cm += 1) {
      arr.push({ y: cm * ppc, label: String(cm), major: true });
      const half = (cm + 0.5) * ppc;
      if (half <= pageH) arr.push({ y: half, label: "", major: false });
    }
    return arr;
  }, [pageH, ppc, totalCm]);

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 bg-slate-100 text-[8px] font-medium text-slate-500"
      style={{ width: RULER, height: pageH }}
    >
      <div className="absolute right-0 top-0 h-full border-r border-slate-300" style={{ width: RULER }}>
        {ticks.map((t, i) => (
          <div
            key={i}
            className="absolute left-0"
            style={{ top: t.y, width: RULER }}
          >
            <div
              className="bg-slate-400"
              style={{ height: 1, width: t.major ? 8 : 4, marginLeft: t.major ? 4 : 6 }}
            />
            {t.major ? (
              <span
                className="absolute select-none"
                style={{
                  left: 2,
                  top: -3,
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
              >
                {t.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Camada de grade sobre o papel (cm). */
export function GridOverlay({ pageW, pageH }: { pageW: number; pageH: number }) {
  const ppc = pxPerCm(pageW);
  const lines: React.ReactNode[] = [];
  for (let x = ppc; x < pageW; x += ppc) {
    lines.push(
      <div
        key={`v${x}`}
        className="absolute top-0 bg-sky-400/20"
        style={{ left: x, width: 1, height: pageH }}
      />,
    );
  }
  for (let y = ppc; y < pageH; y += ppc) {
    lines.push(
      <div
        key={`h${y}`}
        className="absolute left-0 bg-sky-400/20"
        style={{ top: y, height: 1, width: pageW }}
      />,
    );
  }
  return <div className="pointer-events-none absolute inset-0 z-10">{lines}</div>;
}

export const RULER_SIZE = RULER;
