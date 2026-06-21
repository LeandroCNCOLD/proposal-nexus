// Ponte legada: helpers e mappers Nomus vivem agora em src/modules/nomus.
// Mantemos estes exports para preservar chamadas existentes.
export {
  parseNomusNumber,
  pickStr,
  pickNumBR,
  pickInt,
  pickDate,
  pickDateTime,
  extractTotalTributacao,
} from "@/modules/nomus/mappers/parseHelpers";

export {
  mapNomusProposal,
  extractProposalItems,
  mapNomusProposal as mapNomusProposalToMirror,
  extractProposalItems as mapNomusItemsToMirrorItems,
} from "@/modules/nomus/mappers";

export type { NomusProposalMapped, NomusProposalItemMapped } from "@/modules/nomus/types";
