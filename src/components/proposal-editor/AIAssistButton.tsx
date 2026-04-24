// Botão "IA Vendas" da toolbar do RichTextEditor.
// Abre popover com ações de escrita, vendas/PNL e análise.
// Resultado vai pra um Dialog com preview, botões Aplicar/Inserir/Descartar.
import { useState } from "react";
import {
  Sparkles,
  Loader2,
  Wand2,
  ScanText,
  PenLine,
  Megaphone,
  Target,
  Lightbulb,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { aiAssistText, type AiAssistAction } from "@/integrations/proposal-editor/ai.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  /** Função para obter o texto-alvo (selecionado ou bloco inteiro). */
  getText: () => { text: string; html: string; hasSelection: boolean };
  /** Aplica o resultado substituindo o texto-alvo. */
  onApply: (html: string) => void;
  /** Insere o resultado depois do texto-alvo. */
  onInsertAfter: (html: string) => void;
  /** Dica de contexto (ex.: "página: Nossa Solução"). */
  contextHint?: string;
  className?: string;
}

interface ActionDef {
  id: AiAssistAction;
  label: string;
  hint: string;
}

const GROUPS: { title: string; icon: React.ElementType; actions: ActionDef[] }[] = [
  {
    title: "Escrita técnica",
    icon: PenLine,
    actions: [
      { id: "improve", label: "Melhorar escrita", hint: "Gramática, fluidez e clareza" },
      { id: "summarize", label: "Resumir", hint: "Versão curta preservando dados" },
      { id: "expand", label: "Expandir", hint: "Mais profundidade técnica" },
      { id: "continue", label: "Sugerir continuação", hint: "Avança o argumento" },
      { id: "bullets", label: "Reescrever em bullets", hint: "Lista escaneável" },
    ],
  },
  {
    title: "Vendas e persuasão (PNL)",
    icon: Megaphone,
    actions: [
      { id: "consultive", label: "Tom consultivo", hint: "Autoridade de especialista" },
      { id: "benefits", label: "Foco em benefícios", hint: "Features → ganhos para o cliente" },
      { id: "nlp_triggers", label: "Gatilhos PNL", hint: "Autoridade, prova social, escassez" },
      { id: "storytelling", label: "Storytelling problema → solução", hint: "Narrativa de vendas" },
      { id: "objections", label: "Quebra de objeções", hint: "Antecipa preço, prazo, manutenção" },
      { id: "cta", label: "Adicionar CTA de fechamento", hint: "Próximo passo concreto" },
    ],
  },
  {
    title: "Análise",
    icon: Target,
    actions: [
      { id: "analyze", label: "Analisar texto", hint: "Score, gatilhos, sugestões" },
      { id: "variations", label: "Comparar 2 variações", hint: "Mais técnica × mais comercial" },
    ],
  },
];

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export function AIAssistButton({
  getText,
  onApply,
  onInsertAfter,
  contextHint,
  className,
}: Props) {
  const aiFn = useServerFn(aiAssistText);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [freePrompt, setFreePrompt] = useState("");
  const [loading, setLoading] = useState<AiAssistAction | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultHtml, setResultHtml] = useState("");
  const [resultAction, setResultAction] = useState<AiAssistAction | null>(null);
  const [originalHtml, setOriginalHtml] = useState("");

  const run = async (action: AiAssistAction, instruction?: string) => {
    const target = getText();
    const text = stripHtml(target.html || target.text || "").trim();
    if (!text) {
      toast.error("Escreva algo no campo antes de usar a IA.");
      return;
    }
    setLoading(action);
    try {
      const res = await aiFn({
        data: { action, text, instruction, contextHint },
      });
      setOriginalHtml(target.html);
      setResultHtml(res.content);
      setResultAction(action);
      setResultOpen(true);
      setPopoverOpen(false);
      setFreePrompt("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na IA.");
    } finally {
      setLoading(null);
    }
  };

  const isAnalysis = resultAction === "analyze" || resultAction === "variations";

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 gap-1 px-2 text-xs font-medium text-primary hover:text-primary",
              className,
            )}
            title="Assistente IA — escrita técnica e vendas (PNL)"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            IA Vendas
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="z-[2100] w-[340px] max-h-[70vh] overflow-y-auto p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Assistente IA
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Opera no texto selecionado, ou no campo inteiro se nada estiver selecionado.
            </p>
          </div>

          {GROUPS.map((g) => {
            const Icon = g.icon;
            return (
              <div key={g.title} className="border-b py-1.5">
                <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {g.title}
                </div>
                {g.actions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={loading !== null}
                    onClick={() => run(a.id)}
                    className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {loading === a.id ? (
                      <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" />
                    ) : (
                      <Wand2 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1">
                      <div className="font-medium leading-tight">{a.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        {a.hint}
                      </div>
                    </span>
                  </button>
                ))}
              </div>
            );
          })}

          <div className="p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Lightbulb className="h-3 w-3" /> Prompt livre
            </div>
            <Textarea
              value={freePrompt}
              onChange={(e) => setFreePrompt(e.target.value)}
              placeholder="Ex.: Reescreva como se fosse para o diretor industrial; mais formal."
              className="min-h-[60px] text-xs"
            />
            <Button
              type="button"
              size="sm"
              className="mt-2 h-7 w-full text-xs"
              disabled={loading !== null || !freePrompt.trim()}
              onClick={() => run("free", freePrompt.trim())}
            >
              {loading === "free" ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-3 w-3" />
              )}
              Aplicar prompt
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Resultado da IA
            </DialogTitle>
            <DialogDescription>
              {isAnalysis
                ? "Diagnóstico — não substitui o texto, apenas mostra sugestões."
                : "Compare o texto original com a versão sugerida pela IA."}
            </DialogDescription>
          </DialogHeader>

          <div className={cn("grid gap-3", isAnalysis ? "grid-cols-1" : "grid-cols-2")}>
            {!isAnalysis && (
              <div className="flex flex-col">
                <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ScanText className="h-3 w-3" /> Original
                </div>
                <div
                  className="prose prose-sm max-w-none flex-1 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm"
                  style={{ maxHeight: "50vh" }}
                  dangerouslySetInnerHTML={{ __html: originalHtml || "<em>(vazio)</em>" }}
                />
              </div>
            )}
            <div className="flex flex-col">
              <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" /> Sugestão da IA
              </div>
              <div
                className="prose prose-sm max-w-none flex-1 overflow-y-auto rounded-md border border-primary/40 bg-primary/5 p-3 text-sm"
                style={{ maxHeight: "50vh" }}
                dangerouslySetInnerHTML={{ __html: resultHtml }}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setResultOpen(false)}>
              Descartar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onInsertAfter(resultHtml);
                setResultOpen(false);
                toast.success("Sugestão inserida abaixo.");
              }}
            >
              <ListChecks className="mr-1 h-3.5 w-3.5" />
              Inserir abaixo
            </Button>
            {!isAnalysis && (
              <Button
                onClick={() => {
                  onApply(resultHtml);
                  setResultOpen(false);
                  toast.success("Texto substituído.");
                }}
              >
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                Aplicar (substituir)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
