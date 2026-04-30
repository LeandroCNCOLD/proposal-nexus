import { z } from "zod";

export const installmentSchema = z.object({
  description: z.string().trim().min(1, "Descrição obrigatória").max(200),
  percentage: z.number().min(0).max(100),
  days: z.number().int().min(0),
});

export const presetCreateSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().default(true),
  installments: z.array(installmentSchema).min(1, "Inclua ao menos uma parcela"),
});

export const presetUpdateSchema = presetCreateSchema.extend({
  id: z.string().uuid(),
});

export const presetIdSchema = z.object({
  id: z.string().uuid(),
});

export const presetToggleSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
});

export const presetListSchema = z
  .object({ onlyActive: z.boolean().optional() })
  .optional()
  .default({});

export const saveProposalFinancialSchema = z.object({
  proposalId: z.string().uuid(),
  monthlyRatePct: z.number().min(0),
  rateType: z.enum(["compostos", "simples"]),
  installments: z.array(installmentSchema).min(1),
  presetId: z.string().uuid().optional().nullable(),
  // Quando o usuário aceita atualizar a base após mudança de total_value
  refreshOriginalAmount: z.boolean().optional().default(false),
});

export const proposalIdSchema = z.object({ proposalId: z.string().uuid() });

export type InstallmentInputDTO = z.infer<typeof installmentSchema>;
export type PresetCreateDTO = z.infer<typeof presetCreateSchema>;
export type PresetUpdateDTO = z.infer<typeof presetUpdateSchema>;
export type SaveProposalFinancialDTO = z.infer<typeof saveProposalFinancialSchema>;
