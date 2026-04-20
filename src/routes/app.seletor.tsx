import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Sparkles, Swords, FolderUp, FileBarChart, FileCheck2, Settings } from "lucide-react";

const PAGES = {
  seletor: { icon: Sparkles, title: "Seletor Técnico Inteligente", desc: "Informe aplicação, temperatura, umidade e carga térmica — o sistema sugere os equipamentos mais aderentes da base CN Cold com justificativa técnica." },
  competitiva: { icon: Swords, title: "Inteligência Competitiva — Head-to-Head", desc: "Comparativo direto entre propostas CN Cold e propostas de concorrentes: preço, prazo, escopo, garantia e taxa de vitória por linha/segmento." },
  documentos: { icon: FolderUp, title: "Documentos & IA Documental", desc: "Upload de PDFs (propostas próprias, propostas de concorrentes, catálogos). Extração automática, vínculo com propostas e enriquecimento da base competitiva." },
  relatorios: { icon: FileBarChart, title: "Relatórios & Analytics", desc: "Relatórios consolidados: aging, conversão por vendedor, motivos de perda, comparações de preço e prazo, performance por template." },
  aprovacoes: { icon: FileCheck2, title: "Workflow de Aprovações", desc: "Solicitações de desconto, condições especiais, exceções técnicas — com trilha de auditoria, aprovador, status e SLA." },
  configuracoes: { icon: Settings, title: "Configurações & Permissões", desc: "Gestão de usuários, papéis (vendedor, gerente, engenharia, diretoria, admin), parâmetros do sistema e templates padrão." },
};

function ModulePlaceholder({ slug }: { slug: keyof typeof PAGES }) {
  const m = PAGES[slug];
  return (
    <>
      <PageHeader title={m.title} subtitle="Módulo em construção — fundação pronta para esta tela" />
      <div className="rounded-xl border-2 border-dashed bg-card/50 p-12 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
          <m.icon className="h-7 w-7 text-primary-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{m.title}</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{m.desc}</p>
        <p className="mt-4 text-xs text-muted-foreground">Schema, rotas e permissões já estão prontos. Peça para implementar este módulo na próxima iteração.</p>
      </div>
    </>
  );
}

export const Route = createFileRoute("/app/seletor")({ component: () => <ModulePlaceholder slug="seletor" /> });
export const SeletorComponent = ModulePlaceholder;
