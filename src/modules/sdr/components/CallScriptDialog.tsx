import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Phone, MessageCircle, Mail, Copy, Check, Save } from 'lucide-react'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import type { CrmPipeline } from '../types'
import { insertCallLog } from '../services'

interface Props {
  lead: CrmPipeline | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
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

export function CallScriptDialog({ lead, open, onOpenChange, onSaved }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [openingNote, setOpeningNote] = useState('')
  const [closingNote, setClosingNote] = useState('')
  const [saving, setSaving] = useState(false)

  const contactName = lead?.contact_name || 'Cliente'
  const firstName = contactName.split(' ')[0]
  const sdrName = lead?.sdr_name || 'SDR'
  const company = lead?.razao_social || lead?.client_name || ''
  const proposalRef = lead?.proposal_title || lead?.lead_code || ''

  const discoveryQuestions = useMemo(() => lead ? [
    `Você conseguiu analisar a proposta da ${company}?`,
    `O escopo (${lead.proposal_desc?.slice(0, 120) || 'projeto'}${lead.proposal_desc && lead.proposal_desc.length > 120 ? '...' : ''}) atende ao que vocês precisam?`,
    `Qual a previsão de fechamento que vocês estão trabalhando?`,
    `Quem mais participa da decisão além de você?`,
    `Já receberam propostas de concorrentes? Como estamos no comparativo?`,
  ] : [], [lead, company])

  if (!lead) return null

  const openingScript = `Olá, ${firstName}! Aqui é o ${sdrName} da CN Cold. Tudo bem? Estou ligando referente à proposta ${proposalRef} (${lead.lead_code}) no valor de ${fmtBRL(lead.value)} que enviamos${lead.proposal_date ? ` em ${new Date(lead.proposal_date).toLocaleDateString('pt-BR')}` : ''}. Tem 2 minutinhos para conversarmos?`

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

  const buildObservation = () => {
    const parts: string[] = []
    parts.push('📞 Script de ligação concluído')
    if (openingNote.trim()) parts.push(`\n— Abertura: ${openingNote.trim()}`)
    const qa = discoveryQuestions
      .map((q, i) => ({ q, a: (answers[i] || '').trim() }))
      .filter(x => x.a)
    if (qa.length) {
      parts.push('\n— Descoberta:')
      qa.forEach(({ q, a }, i) => parts.push(`${i + 1}. ${q}\n   → ${a}`))
    }
    if (closingNote.trim()) parts.push(`\n— Fechamento: ${closingNote.trim()}`)
    return parts.join('\n')
  }

  const handleSaveAsCompleted = async () => {
    if (!lead) return
    const hasAnyAnswer = Object.values(answers).some(v => v.trim()) || openingNote.trim() || closingNote.trim()
    if (!hasAnyAnswer) {
      toast.error('Preencha ao menos uma resposta antes de salvar.')
      return
    }
    setSaving(true)
    try {
      const now = new Date()
      await insertCallLog({
        pipeline_id: lead.id,
        sdr_id: lead.sdr_id,
        sdr_name: lead.sdr_name || 'SDR',
        call_date: now.toISOString().slice(0, 10),
        call_time: now.toTimeString().slice(0, 8),
        duration_min: null,
        result: 'Atendeu - Muito interessado',
        temperature_after: lead.temperature,
        meeting_booked: false,
        observation: buildObservation(),
        channel: 'Telefone',
        proof_path: null,
        proof_validated: true,
      } as any)
      toast.success('Atividade salva como concluída na linha do tempo!')
      setAnswers({})
      setOpeningNote('')
      setClosingNote('')
      onSaved?.()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar atividade')
    } finally {
      setSaving(false)
    }
  }

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
        </div>

        {/* 1 - Abertura */}
        <ScriptBlock title="1️⃣ Abertura" text={openingScript} onCopy={() => copy(openingScript, 'open')} copied={copied === 'open'} />
        <div className="px-1">
          <label className="text-xs text-muted-foreground">Resposta/observação do cliente na abertura</label>
          <Textarea
            value={openingNote}
            onChange={(e) => setOpeningNote(e.target.value)}
            placeholder="Ex: cliente atendeu, demonstrou interesse..."
            rows={2}
          />
        </div>

        {/* 2 - Descoberta com campos de resposta */}
        <div className="border rounded-md p-3 bg-blue-50/40 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">2️⃣ Descoberta — perguntas e respostas</div>
          {discoveryQuestions.map((q, i) => (
            <div key={i} className="space-y-1">
              <div className="text-sm font-medium">{i + 1}. {q}</div>
              <Textarea
                value={answers[i] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                placeholder="Resposta do cliente..."
                rows={2}
              />
            </div>
          ))}
        </div>

        {/* 3 - Objeções */}
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

        {/* 4 - Fechamento */}
        <ScriptBlock title="4️⃣ Fechamento da ligação" text={closingScript} onCopy={() => copy(closingScript, 'close')} copied={copied === 'close'} />
        <div className="px-1">
          <label className="text-xs text-muted-foreground">Resposta/combinado final com o cliente</label>
          <Textarea
            value={closingNote}
            onChange={(e) => setClosingNote(e.target.value)}
            placeholder="Ex: ficou de retornar dia X, pediu para enviar resumo..."
            rows={2}
          />
        </div>

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

        {/* Salvar como atividade concluída */}
        <div className="sticky bottom-0 bg-background border-t pt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSaveAsCompleted} disabled={saving} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Salvando...' : 'Salvar e concluir atividade'}
          </Button>
        </div>
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
