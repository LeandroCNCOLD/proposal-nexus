import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { buildCalibrationReport, evaluateCalibration, parseKfcalcCsv } from "./calibrationEngine";

const sampleCsv = [
  "arquivo,volume_m3,temp_interna_C,temp_externa_C,UR_interna,UR_externa,tempo_processo_h,carga_infiltracao,carga_produtos,carga_trocas_ar,carga_iluminacao,carga_motores,carga_pessoas,carga_total,coef_seguranca",
  'A,100,2,30,0.70,0.70,24,"100,00","200,00","50,00","10,00","20,00","30,00","451,00","41,00"',
  'B,100,2,30,0.70,0.70,24,"200,00","200,00","50,00","10,00","20,00","30,00","561,00","51,00"',
].join("\n");

{
  const rows = parseKfcalcCsv(sampleCsv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].cargas.infiltracao, 100);
  assert.equal(rows[0].cargas.total, 451);
}

{
  const rows = evaluateCalibration(parseKfcalcCsv(sampleCsv), {
    produto: 1,
    infiltracao: 1,
    trocasAr: 1,
    iluminacao: 1,
    motores: 1,
    pessoas: 1,
    coefSeguranca: 0,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].coldproTotal, 410);
  assert.ok(rows[0].erroPercentual < 0);
}

{
  const csv = readFileSync(
    "/home/ubuntu/.cursor/projects/workspace/uploads/projetos_kfcalc.csv",
    "utf8",
  );
  const result = buildCalibrationReport(parseKfcalcCsv(csv));
  assert.ok(result.rows.length > 0);
  assert.ok(Number.isFinite(result.media_erro_percentual));
  assert.ok(Math.abs(result.media_erro_percentual) < 10);
}

console.log("calibrationEngine tests passed");
