import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, MessageCircle, Mail, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { CrmPipeline } from '../types'

interface Props {
  lead: CrmPipeline | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function digitsOnly(p: string | null) {
  if (!p) return ''
  return p.replace(/\D/g, '')
}

function whatsappUrl(phone: string | null, message: string) {
  const d = digitsOnly(phone)
  if (!d) return '#'
  const intl = d.startsWith('55') ? d : `55${d}`
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}

export function CallScriptDialog({ lead, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState<string | null>(null)

  if (!lead) return null

  const contactName = lead.contact_name || 'Cliente'
  const firstName = contactName.split(' ')[0]
  const sdrName = lead.sdr_name || 'SDR'
  const company = lead.razao_social || lead.client_name
  const proposalRef = lead.proposal_title || lead.lead_code

  const openingScript = `Olá, ${firstName}! Aqui é o ${sdrName} da CN Cold. Tudo bem? Estou ligando referente à proposta ${proposalRef} (${lead.lead_code}) no valor de ${fmtBRL(lead.value)} que enviamos${lead.proposal_date ? ` em ${new Date(lead.proposal_date).toLocaleDateString('pt-BR')}` : ''}. Tem 2 minutinhos para conversarmos?`

  const discoveryQuestions = [
    `Você conseguiu analisar a proposta da ${company}?`,
    `O escopo (${lead.proposal_desc?.slice(0, 120) || 'projeto'}${lead.proposal_desc && lead.proposal_desc.length > 120 ? '...' : ''}) atende ao que vocês precisam?`,
    `Qual a previsão de fechamento que vocês estão trabalhando?`,
    `Quem mais participa da decisão além de você?`,
    `Já receberam propostas de concorrentes? Como estamos no comparativo?`,
  ]

  const objectionHandling = [
    { obj: 'Preço alto', resp: `O valor de ${fmtBRL(lead.value)} reflete a engenharia CN Cold + 10 anos de garantia. Posso te mostrar o ROI vs. equipamento comercial?` },
    { obj: 'Sem orçamento agora', resp: `Entendi. Temos condições especiais de pagamento (entrada + parcelas). Quando seria o melhor momento para retomar?` },
    { obj: 'Vou pensar', resp: `Claro. Posso te ligar ${lead.expected_closing ? `na semana de ${new Date(lead.expected_closing).toLocaleDateString('pt-BR')}` : 'na próxima semana'} para falarmos?` },
    { obj: 'Fechei com concorrente', resp: `Sem problemas. Só por curiosidade, qual foi o fator decisivo? Isso ajuda a melhorarmos.` },
  ]

  const closingScript = `Combinado, ${firstName}. Vou agendar nosso próximo contato${lead.expected_closing ? ` próximo a ${new Date(lead.expected_closing).toLocaleDateString('pt-BR')}` : ''}. Mando também por WhatsApp um resumo da proposta. Qualquer dúvida me chama. Obrigado!`

  const whatsappFollowup = `Olá ${firstName}, aqui é o ${sdrName} da CN Cold. Conforme conversamos, segue o resumo da proposta ${proposalRef} no valor de ${fmtBRL(lead.value)}. Validade: ${lead.validity_days || 5} dias. Qualquer dúvida, estou à disposição!`

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    toast.success('Copiado!')
    setTimeout(() => setCopied(null), 1500)
  }

  const phone = lead.contact_mobile || lead.contact_phone

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-600" />
            Script de Ligação — {contactName}
          </DialogTitle>
          <DialogDescription>
            {company} · {lead.city || '—'}/{lead.state || '—'} · {fmtBRL(lead.value)}
          </DialogDescription>
        </DialogHeader>

        {/* Contato rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted/40 rounded-md">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Celular</div>
              <div className="font-mono">{lead.contact_mobile || '—'}</div>
            </div>
            {lead.contact_mobile && (
              <a href={`tel:${digitsOnly(lead.contact_mobile)}`}>
                <Button size="sm" className="bg-green-600 hover:bg-green-700"><Phone className="w-3 h-3" /></Button>
              </a>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Fixo</div>
              <div className="font-mono">{lead.contact_phone || '—'}</div>
            </div>
            {lead.contact_phone && (
              <a href={`tel:${digitsOnly(lead.contact_phone)}`}>
                <Button size="sm" variant="outline"><Phone className="w-3 h-3" /></Button>
              </a>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">E-mail</div>
              <div className="truncate text-xs">{lead.contact_email || '—'}</div>
            </div>
            {lead.contact_email && (
              <a href={`mailto:${lead.contact_email}`}>
                <Button size="sm" variant="outline"><Mail className="w-3 h-3" /></Button>
              </a>
            )}
          </div>
        </div>

        {/* Resumo da proposta */}
        <div className="border rounded-md p-3 text-sm space-y-1">
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant="outline">{lead.lead_code}</Badge>
            <Badge variant="secondary">{lead.temperature}</Badge>
            <Badge variant="outline">{lead.sdr_status}</Badge>
            {lead.priority && <Badge>{lead.priority}</Badge>}
          </div>
          <div><strong>Título:</strong> {lead.proposal_title || '—'}</div>
          {lead.proposal_desc && <div className="text-muted-foreground text-xs">{lead.proposal_desc}</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2">
            <div><span className="text-muted-foreground">CNPJ:</span> {lead.cnpj || '—'}</div>
            <div><span className="text-muted-foreground">Desconto:</span> {lead.discount_pct ?? 0}%</div>
            <div><span className="text-muted-foreground">Validade:</span> {lead.validity_days || 0} dias</div>
            <div><span className="text-muted-foreground">Versão:</span> {lead.proposal_version || 0}</div>
            <div><span className="text-muted-foreground">Data proposta:</span> {lead.proposal_date ? new Date(lead.proposal_date).toLocaleDateString('pt-BR') : '—'}</div>
            <div><span className="text-muted-foreground">Entrega prevista:</span> {lead.expected_delivery ? new Date(lead.expected_delivery).toLocaleDateString('pt-BR') : '—'}</div>
            <div><span className="text-muted-foreground">Fechamento esperado:</span> {lead.expected_closing ? new Date(lead.expected_closing).toLocaleDateString('pt-BR') : '—'}</div>
            <div><span className="text-muted-foreground">Closer:</span> {lead.closer_name || '—'}</div>
          </div>
          {lead.delivery_term && (
            <div className="text-xs mt-2 pt-2 border-t">
              <span className="text-muted-foreground">Prazo:</span> {lead.delivery_term}
            </div>
          )}
        </div>

        {/* SCRIPT */}
        <ScriptBlock title="1️⃣ Abertura" text={openingScript} onCopy={() => copy(openingScript, 'open')} copied={copied === 'open'} />

        <div className="border rounded-md p-3 bg-blue-50/40">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">2️⃣ Descoberta — perguntas chave</div>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            {discoveryQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </div>

        <div className="border rounded-md p-3 bg-amber-50/40">
          <div className="text-sm font-semibold mb-2">3️⃣ Quebra de objeções</div>
          <div className="space-y-2">
            {objectionHandling.map((o, i) => (
              <div key={i} className="text-sm">
                <div className="font-semibold text-amber-900">❌ {o.obj}</div>
                <div className="text-muted-foreground pl-4">→ {o.resp}</div>
              </div>
            ))}
          </div>
        </div>

        <ScriptBlock title="4️⃣ Fechamento da ligação" text={closingScript} onCopy={() => copy(closingScript, 'close')} copied={copied === 'close'} />

        {/* WhatsApp follow-up */}
        <div className="border rounded-md p-3 bg-green-50/40 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-700" /> 5️⃣ Follow-up por WhatsApp
          </div>
          <p className="text-sm whitespace-pre-wrap">{whatsappFollowup}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(whatsappFollowup, 'wa')}>
              {copied === 'wa' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />} Copiar mensagem
            </Button>
            <a href={whatsappUrl(phone, whatsappFollowup)} target="_blank" rel="noreferrer">
              <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={!phone}>
                <MessageCircle className="w-3 h-3 mr-1" /> Abrir WhatsApp
              </Button>
            </a>
          </div>
        </div>

        {/* Última interação */}
        {(lead.call_observation || lead.internal_note) && (
          <div className="border rounded-md p-3 text-sm">
            <div className="font-semibold mb-1">📝 Histórico relevante</div>
            {lead.call_observation && <p className="text-muted-foreground">{lead.call_observation}</p>}
            {lead.internal_note && <p className="text-xs text-muted-foreground italic mt-1">Nota interna: {lead.internal_note}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScriptBlock({ title, text, onCopy, copied }: { title: string; text: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="border rounded-md p-3 bg-card">
      <div className="flex justify-between items-center mb-1">
        <div className="text-sm font-semibold">{title}</div>
        <Button size="sm" variant="ghost" onClick={onCopy}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </div>
  )
}
