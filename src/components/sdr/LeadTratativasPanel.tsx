import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Paperclip, Upload, Download, Pencil, Trash2, MessageSquare,
  Image as ImageIcon, FileText, Phone, Mail, MapPin, Save, X, Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { dateTimeBR } from '@/lib/format'

type Tratativa = {
  id: string
  lead_id: string
  body: string
  channel: string | null
  storage_path: string | null
  file_name: string | null
  file_mime: string | null
  file_size: number | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'ligacao', label: 'Ligação', icon: Phone },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'visita', label: 'Visita', icon: MapPin },
  { value: 'outro', label: 'Outro', icon: FileText },
] as const

const BUCKET = 'crm-attachments'
const MAX_FILE = 10 * 1024 * 1024 // 10MB

function channelMeta(c: string | null) {
  return CHANNELS.find(x => x.value === c) ?? CHANNELS[4]
}

function fmtSize(n: number | null | undefined) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

async function uploadFile(leadId: string, file: File): Promise<{ path: string; name: string; mime: string; size: number }> {
  if (file.size > MAX_FILE) throw new Error('Arquivo maior que 10MB')
  const ext = file.name.split('.').pop() ?? 'bin'
  const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80)
  const path = `sdr-leads/${leadId}/${crypto.randomUUID()}-${safe || `file.${ext}`}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw error
  return { path, name: file.name, mime: file.type || 'application/octet-stream', size: file.size }
}

async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export function LeadTratativasPanel({ leadId }: { leadId: string }) {
  const qc = useQueryClient()
  const { user, hasAnyRole } = useAuth()
  const isManager = hasAnyRole(['admin', 'diretoria', 'gerente_comercial'] as never)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sdr-tratativas', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_lead_tratativas' as never)
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Tratativa[]
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sdr-tratativas', leadId] })

  // ---- create
  const [openNew, setOpenNew] = useState(false)
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState<string>('whatsapp')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const createMut = useMutation({
    mutationFn: async () => {
      if (!body.trim()) throw new Error('Descreva a tratativa')
      if (!user?.id) throw new Error('Não autenticado')
      let f: Awaited<ReturnType<typeof uploadFile>> | null = null
      if (file) f = await uploadFile(leadId, file)
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const row = {
        lead_id: leadId,
        body: body.trim(),
        channel,
        storage_path: f?.path ?? null,
        file_name: f?.name ?? null,
        file_mime: f?.mime ?? null,
        file_size: f?.size ?? null,
        created_by: user.id,
        created_by_name: prof?.full_name ?? user.email ?? null,
      }
      const { error } = await supabase.from('sdr_lead_tratativas' as never).insert(row as never)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Tratativa registrada')
      setBody(''); setFile(null); setChannel('whatsapp'); setOpenNew(false)
      if (fileRef.current) fileRef.current.value = ''
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Tratativas & Evidências
          <Badge variant="secondary" className="ml-1">{items.length}</Badge>
        </CardTitle>
        {!openNew && (
          <Button size="sm" onClick={() => setOpenNew(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Nova tratativa
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {openNew && (
          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            <div className="flex gap-2 items-center">
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="h-8 text-xs"
              />
            </div>
            <Textarea
              rows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Descreva o que aconteceu (ex.: cliente respondeu no WhatsApp, pediu desconto…)"
            />
            {file && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Paperclip className="h-3 w-3" /> {file.name} · {fmtSize(file.size)}
                <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="text-destructive hover:underline">remover</button>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setOpenNew(false); setBody(''); setFile(null) }}>
                <X className="h-3 w-3 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                <Save className="h-3 w-3 mr-1" /> {createMut.isPending ? 'Salvando…' : 'Salvar tratativa'}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-4 text-center">
            Nenhuma tratativa registrada. Clique em <strong>Nova tratativa</strong> para adicionar evidências.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map(t => (
              <TratativaItem
                key={t.id}
                t={t}
                isManager={isManager}
                isOwner={t.created_by === user?.id}
                onChanged={invalidate}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function TratativaItem({ t, isManager, isOwner, onChanged }: { t: Tratativa; isManager: boolean; isOwner: boolean; onChanged: () => void }) {
  const meta = channelMeta(t.channel)
  const Icon = meta.icon
  const canEdit = isOwner || isManager
  const canDelete = isManager

  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(t.body)
  const [channel, setChannel] = useState(t.channel ?? 'outro')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function openFile() {
    if (!t.storage_path) return
    try {
      const url = await signedUrl(t.storage_path)
      window.open(url, '_blank')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao abrir arquivo')
    }
  }

  async function save() {
    setBusy(true)
    try {
      const patch: Partial<Tratativa> = { body: body.trim(), channel }
      if (file) {
        const f = await uploadFile(t.lead_id, file)
        patch.storage_path = f.path
        patch.file_name = f.name
        patch.file_mime = f.mime
        patch.file_size = f.size
      }
      const { error } = await supabase.from('sdr_lead_tratativas' as never).update(patch as never).eq('id', t.id)
      if (error) throw error
      toast.success('Tratativa atualizada')
      setEditing(false); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm('Excluir esta tratativa? Esta ação não pode ser desfeita.')) return
    setBusy(true)
    try {
      if (t.storage_path) {
        await supabase.storage.from(BUCKET).remove([t.storage_path]).catch(() => {})
      }
      const { error } = await supabase.from('sdr_lead_tratativas' as never).delete().eq('id', t.id)
      if (error) throw error
      toast.success('Tratativa excluída')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally { setBusy(false) }
  }

  const isImage = (t.file_mime ?? '').startsWith('image/')

  return (
    <li className="border rounded-md p-3 bg-card">
      <div className="flex items-start gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1"><Icon className="h-3 w-3" />{meta.label}</Badge>
        <div className="text-xs text-muted-foreground flex-1">
          {t.created_by_name || 'Usuário'} · {dateTimeBR(t.created_at)}
          {t.updated_at !== t.created_at && <span className="italic"> · editada em {dateTimeBR(t.updated_at)}</span>}
        </div>
        <div className="flex items-center gap-1">
          {canEdit && !editing && (
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Editar
            </Button>
          )}
          {canDelete && !editing && (
            <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={remove} disabled={busy}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <Select value={channel ?? 'outro'} onValueChange={setChannel}>
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="h-8 text-xs"
            />
          </div>
          <Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} />
          {file ? (
            <div className="text-xs text-muted-foreground">Substituirá o anexo atual por <strong>{file.name}</strong> ({fmtSize(file.size)})</div>
          ) : t.storage_path ? (
            <div className="text-xs text-muted-foreground">
              Anexo atual: {t.file_name}. {canDelete ? 'Apenas gestores podem remover; você pode substituir enviando outro arquivo.' : 'Você pode substituir enviando outro arquivo. A exclusão só pode ser feita por um gestor.'}
            </div>
          ) : null}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setBody(t.body); setChannel(t.channel ?? 'outro'); setFile(null) }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              <Save className="h-3 w-3 mr-1" /> {busy ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{t.body}</div>
          {t.storage_path && (
            <div className="mt-2">
              {isImage ? (
                <button onClick={openFile} className="block group">
                  <SignedImage path={t.storage_path} alt={t.file_name ?? ''} />
                  <div className="text-[11px] text-muted-foreground mt-1 group-hover:text-foreground inline-flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> {t.file_name} · {fmtSize(t.file_size)}
                  </div>
                </button>
              ) : (
                <Button size="sm" variant="outline" onClick={openFile} className="h-7 gap-1">
                  <Download className="h-3 w-3" /> {t.file_name}
                  <span className="text-muted-foreground text-[11px] ml-1">{fmtSize(t.file_size)}</span>
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </li>
  )
}

function SignedImage({ path, alt }: { path: string; alt: string }) {
  const { data } = useQuery({
    queryKey: ['signed', path],
    queryFn: () => signedUrl(path),
    staleTime: 5 * 60 * 1000,
  })
  if (!data) return <div className="w-40 h-24 rounded bg-muted animate-pulse" />
  return <img src={data} alt={alt} className="max-h-48 rounded border object-contain bg-muted" />
}
