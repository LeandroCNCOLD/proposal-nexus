import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Phone, MessageCircle, Mail, Copy, Check, Save } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'

function openTel(phone: string) {
  const d = phone.replace(/\D/g, '')
  if (!d) return
  // tel: only works when the OS/browser has a registered handler (mobile, FaceTime, Skype, etc.).
  // On desktops without a handler the click is silently ignored — that's what happens to users like Vitor.
  // We try window.location first; if nothing happens the user can fall back to WhatsApp/copy from the menu.
  try { window.location.href = `tel:${d}` } catch { /* ignored */ }
}

function copyPhone(phone: string) {
  const d = phone.replace(/\D/g, '')
  navigator.clipboard.writeText(d).then(
    () => toast.success('Número copiado'),
    () => toast.error('Não foi possível copiar')
  )
}

function PhoneActions({ phone, variant = 'default', isMobile }: { phone: string; variant?: 'default' | 'outline'; isMobile: boolean }) {
  const waUrl = (() => {
    const d = phone.replace(/\D/g, '')
    const intl = d.startsWith('55') ? d : `55${d}`
    return `https://wa.me/${intl}`
  })()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={variant === 'outline' ? 'outline' : undefined} className={variant === 'default' ? 'bg-green-600 hover:bg-green-700' : undefined}>
          <Phone className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openTel(phone)}>
          <Phone className="w-4 h-4 mr-2" /> Abrir discador (tel:)
        </DropdownMenuItem>
        {isMobile && (
          <DropdownMenuItem asChild>
            <a href={`https://wa.me/${(phone.replace(/\D/g,'').startsWith('55') ? '' : '55') + phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
            </a>
          </DropdownMenuItem>
        )}
        {!isMobile && (
          <DropdownMenuItem asChild>
            <a href={waUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp Web
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => copyPhone(phone)}>
          <Copy className="w-4 h-4 mr-2" /> Copiar número
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
import type { CrmPipeline } from '../types'
import { insertCallLog } from '../services'
import { useScriptTemplates, renderTemplate } from '../hooks/use-script-templates'

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
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: templates = [] } = useScriptTemplates()
  const activeTemplates = useMemo(() => templates.filter(t => t.is_active), [templates])

  // Seleciona padrão automaticamente
  useEffect(() => {
    if (!selectedId && activeTemplates.length > 0) {
      const def = activeTemplates.find(t => t.is_default) ?? activeTemplates[0]
      setSelectedId(def.id)
    }
  }, [activeTemplates, selectedId])

  const selected = activeTemplates.find(t => t.id === selectedId) ?? null

  const ctx = useMemo(() => {
    if (!lead) return {}
    const contactName = lead.contact_name || 'Cliente'
    return {
      firstName: contactName.split(' ')[0],
      contactName,
      sdrName: lead.sdr_name || 'SDR',
      company: lead.razao_social || lead.client_name || '',
      value: fmtBRL(lead.value),
      proposalRef: lead.proposal_title || lead.lead_code || '',
      leadCode: lead.lead_code,
      proposalDate: lead.proposal_date ? new Date(lead.proposal_date).toLocaleDateString('pt-BR') : '—',
      expectedClosing: lead.expected_closing ? new Date(lead.expected_closing).toLocaleDateString('pt-BR') : 'próxima semana',
      validityDays: String(lead.validity_days ?? 5),
      proposalDesc: lead.proposal_desc?.slice(0, 120) || 'projeto',
    }
  }, [lead])

  if (!lead) return null

  const contactName = lead.contact_name || 'Cliente'
  const company = lead.razao_social || lead.client_name

  const openingScript = selected ? renderTemplate(selected.opening, ctx as any) : ''
  const discoveryQuestions = selected ? selected.discovery_questions.map(q => renderTemplate(q, ctx as any)) : []
  const objectionHandling = selected ? selected.objections.map(o => ({ obj: renderTemplate(o.obj, ctx as any), resp: renderTemplate(o.resp, ctx as any) })) : []
  const closingScript = selected ? renderTemplate(selected.closing, ctx as any) : ''
  const whatsappFollowup = selected ? renderTemplate(selected.whatsapp_followup, ctx as any) : ''

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    toast.success('Copiado!')
    setTimeout(() => setCopied(null), 1500)
  }

  const phone = lead.contact_mobile || lead.contact_phone

  const buildObservation = () => {
    const parts: string[] = []
    parts.push(`📞 Script "${selected?.name ?? 'sem modelo'}" concluído`)
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

        {/* Seletor de modelo */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Modelo de Script</Label>
          {activeTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground border rounded p-2 bg-amber-50">
              Nenhum modelo cadastrado. Peça ao gestor para criar em <strong>Scripts de Ligação</strong>.
            </p>
          ) : (
            <Select value={selectedId ?? ''} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Selecione um modelo..." /></SelectTrigger>
              <SelectContent>
                {activeTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.is_default ? ' (padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

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

        {selected && (
          <>
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
            {discoveryQuestions.length > 0 && (
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
            )}

            {/* 3 - Objeções */}
            {objectionHandling.length > 0 && (
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
            )}

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
            {whatsappFollowup && (
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
            )}
          </>
        )}

        {/* Salvar como atividade concluída */}
        <div className="sticky bottom-0 bg-background border-t pt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSaveAsCompleted} disabled={saving || !selected} className="bg-green-600 hover:bg-green-700">
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
