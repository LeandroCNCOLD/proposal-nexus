import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Save } from "lucide-react";
import { toast } from "sonner";
import type { ColdProState } from "../types/coldPro.types";
import { calculateVolumeM3, defaultSurfaces } from "../services/surfaceAreaService";
import { calculateColdPro } from "../services/coldProEngine";
import { duplicateColdProSeletorCalculation, saveColdProSeletorCalculation } from "../services/coldProPersistence.functions";
import { ColdProTabs, type ColdProTabId } from "./ColdProTabs";
import { ProjectDataTab } from "./ProjectDataTab";
import { DimensionsTab } from "./DimensionsTab";
import { SurfacesTab } from "./SurfacesTab";
import { ProductProcessTab } from "./ProductProcessTab";
import { InfiltrationTab } from "./InfiltrationTab";
import { InternalLoadsTab } from "./InternalLoadsTab";
import { ResultTab } from "./ResultTab";
import { EquipmentSelectionTab } from "./EquipmentSelectionTab";
import { TechnicalReportTab } from "./TechnicalReportTab";
import { Button } from "@/components/ui/button";

const initialDimensions = { lengthM: 10, widthM: 6, heightM: 3, volumeM3: calculateVolumeM3({ lengthM: 10, widthM: 6, heightM: 3 }) };

const initialState: ColdProState = {
  project: { name: "Novo cálculo ColdPro", applicationMode: "cold_room_chilled", internalTempC: 0, externalTempC: 35, altitudeM: 0 },
  dimensions: initialDimensions,
  surfaces: defaultSurfaces(initialDimensions, 35),
  process: {
    operationMode: "batch",
    productName: "Produto",
    massKg: 0,
    productionKgH: 0,
    batchMassKg: 1000,
    batchTimeH: 24,
    inletTempC: 20,
    outletTempC: 0,
    freezingTempC: -1,
    cpAboveKjKgK: 3.6,
    cpBelowKjKgK: 1.9,
    latentHeatKjKg: 250,
    freezableFraction: 0.75,
    retentionTimeMin: 60,
    productThicknessM: 0.04,
    productDensityKgM3: 1000,
    productThermalConductivityWMK: 1.4,
    airVelocityMS: 3,
    airTempC: -35,
    pullDownKw: 0,
  },
  infiltration: { altitudeM: 0, airVolumeInfiltratedM3H: 20, airRenovationM3H: 0, doorOpeningsPerDay: 20, doorAreaM2: 2, openingFactor: 1, internalTempC: 0, externalTempC: 35 },
  internalLoads: { peopleQuantity: 1, peopleLoadW: 350, peopleUseFactor: 0.5, lightingAreaM2: 60, lightingWM2: 8, lightingUseFactor: 0.5, motorsPowerKw: 0, motorsUseFactor: 1, packagingMassKg: 0, packagingCpKjKgK: 1.7, packagingDeltaTK: 0, respirationMassKg: 0, respirationRateWKg: 0, applyRespiration: false, pullDownKw: 0, safetyFactor: 1.1, defrostFactor: 1, fanFactor: 1, operationalFactor: 1 },
};

export function ColdProSeletorApp() {
  const [activeTab, setActiveTab] = React.useState<ColdProTabId>("project");
  const [state, setStateRaw] = React.useState<ColdProState>(initialState);
  const saveCalculation = useServerFn(saveColdProSeletorCalculation);
  const duplicateCalculation = useServerFn(duplicateColdProSeletorCalculation);

  const result = React.useMemo(() => calculateColdPro(state), [state]);

  const setState = React.useCallback((next: ColdProState) => {
    setStateRaw({
      ...next,
      infiltration: {
        ...next.infiltration,
        altitudeM: next.project.altitudeM,
        internalTempC: next.project.internalTempC,
        externalTempC: next.project.externalTempC,
      },
    });
  }, []);

  async function handleSave() {
    try {
      await saveCalculation({ data: { name: state.project.name, applicationMode: state.project.applicationMode, state: state as unknown as Record<string, unknown>, result: result as unknown as Record<string, unknown> } });
      toast.success("Cálculo ColdPro salvo");
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar cálculo");
    }
  }

  async function handleDuplicate() {
    try {
      await duplicateCalculation({ data: { name: state.project.name, applicationMode: state.project.applicationMode, state: state as unknown as Record<string, unknown>, result: result as unknown as Record<string, unknown> } });
      toast.success("Projeto duplicado");
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao duplicar projeto");
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Seletor Técnico ColdPro</h1>
            <p className="text-sm text-muted-foreground">Cálculo de carga térmica, memória técnica e seleção pela base de equipamentos CN Cold.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDuplicate}><Copy className="mr-2 h-4 w-4" />Duplicar</Button>
            <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Salvar cálculo</Button>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-[1440px] p-4">
        <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
          <ColdProTabs active={activeTab} onChange={setActiveTab} />
          <div className="space-y-4 p-4">
            {activeTab === "project" && <ProjectDataTab state={state} setState={setState} />}
            {activeTab === "dimensions" && <DimensionsTab state={state} setState={setState} />}
            {activeTab === "surfaces" && <SurfacesTab state={state} setState={setState} />}
            {activeTab === "process" && <ProductProcessTab state={state} setState={setState} />}
            {activeTab === "infiltration" && <InfiltrationTab state={state} setState={setState} />}
            {activeTab === "internal" && <InternalLoadsTab state={state} setState={setState} />}
            {activeTab === "result" && <ResultTab result={result} />}
            {activeTab === "equipment" && <EquipmentSelectionTab result={result} />}
            {activeTab === "report" && <TechnicalReportTab state={state} result={result} />}
          </div>
        </div>
      </main>
    </div>
  );
}
