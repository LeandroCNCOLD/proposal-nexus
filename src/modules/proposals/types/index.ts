export type ProposalModuleArea =
  | "screens"
  | "components"
  | "services"
  | "templates"
  | "approval"
  | "financial";

export type ProposalModuleBoundary = {
  area: ProposalModuleArea;
  responsibility: string;
};