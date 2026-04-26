import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_FIELD_HELP, getColdProFieldHelp, type ColdProFieldHelp, type ColdProFieldHelpKey } from "../core/fieldHelpTexts";

type FieldHelpTooltipProps = {
  help?: ColdProFieldHelp | null;
  helpKey?: ColdProFieldHelpKey | string | null;
  title?: string;
  content?: string | string[];
};

function resolveHelp({ help, helpKey, title, content }: FieldHelpTooltipProps): ColdProFieldHelp {
  if (title || content) return { title: title ?? DEFAULT_FIELD_HELP.title, content: content ?? DEFAULT_FIELD_HELP.content };
  if (help) return help;
  if (helpKey) return getColdProFieldHelp(helpKey);
  return DEFAULT_FIELD_HELP;
}

function renderContent(content: string | string[]) {
  const parts = Array.isArray(content) ? content : content.split(/\n{2,}|\n/).filter((part) => part.trim().length > 0);
  return (
    <div className="space-y-2">
      {parts.map((part, index) => (
        <p key={`${part.slice(0, 24)}-${index}`} className="m-0 whitespace-normal break-words leading-relaxed">
          {part}
        </p>
      ))}
    </div>
  );
}

export function FieldHelpTooltip(props: FieldHelpTooltipProps) {
  const { title, content } = resolveHelp(props);

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger type="button" className="inline-flex shrink-0 items-center text-muted-foreground transition hover:text-foreground" aria-label={title ? `Ajuda: ${title}` : "Ajuda do campo"}>
          <HelpCircle className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" align="start" sideOffset={8} className="z-[9999] max-h-[70vh] max-w-[calc(100vw-32px)] overflow-y-auto whitespace-normal break-words text-left leading-relaxed sm:max-w-[520px]">
          {title ? <div className="mb-1 font-semibold">{title}</div> : null}
          <div className="whitespace-normal break-words">{renderContent(content)}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
