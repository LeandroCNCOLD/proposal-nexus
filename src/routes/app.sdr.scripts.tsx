import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, FileText, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useScriptTemplates,
  useScriptTemplateMutations,
  type ScriptTemplate,
  type ScriptTemplateInput,
} from '@/modules/sdr/hooks/use-script-templates'

export const Route = createFileRoute('/app/sdr/scripts')({
  component: ScriptTemplatesPage,
})

const EMPTY: ScriptTemplateInput = {
  name: '',
  description: '',
  is_default: false,
  is_active: true,
  opening: '',
  discovery_questions: [],
  objections: [],
  closing: '',
  whatsapp_followup: '',
}

function ScriptTemplatesPage() {
  const { data: templates = [], isLoading } = useScriptTemplates()
  const { create, update, remove } = useScriptTemplateMutations()
  const [editing, setEditing] = useState<ScriptTemplate | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6" /> Scripts de Ligação
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie modelos de script que os SDRs usarão nas ligações.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Script
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modelos disponíveis ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum script ainda. Clique em "Novo Script" para começar.</p>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="border rounded-md p-3 flex items-start justify-between gap-3 hover:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{t.name}</span>
                      {t.is_default && <Badge variant="default">Padrão</Badge>}
                      {!t.is_active && <Badge variant="secondary">Inativo</Badge>}
                      <Badge variant="outline" className="text-xs">{t.discovery_questions.length} perguntas</Badge>
                      <Badge variant="outline" className="text-xs">{t.objections.length} objeções</Badge>
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Excluir "${t.name}"?`)) return
                        try {
                          await remove.mutateAsync(t.id)
                          toast.success('Script excluído.')
                        } catch (e: any) {
                          toast.error(e.message || 'Erro ao excluir')
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      {(creating || editing) && (
        <ScriptEditor
          initial={editing ?? EMPTY}
          onCancel={() => { setCreating(false); setEditing(null) }}
          onSave={async (data) => {
            try {
              if (editing) {
                await update.mutateAsync({ id: editing.id, ...data })
                toast.success('Script atualizado.')
              } else {
                await create.mutateAsync(data)
                toast.success('Script criado.')
              }
              setCreating(false)
              setEditing(null)
            } catch (e: any) {
              toast.error(e.message || 'Erro ao salvar')
            }
          }}
        />
      )}
    </div>
  )
}

function ScriptEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: ScriptTemplateInput | ScriptTemplate
  onCancel: () => void
  onSave: (data: ScriptTemplateInput) => void | Promise<void>
}) {
  const [form, setForm] = useState<ScriptTemplateInput>({
    name: initial.name,
    description: initial.description ?? '',
    is_default: initial.is_default,
    is_active: initial.is_active,
    opening: initial.opening,
    discovery_questions: initial.discovery_questions ?? [],
    objections: initial.objections ?? [],
    closing: initial.closing,
    whatsapp_followup: initial.whatsapp_followup,
  })
  const set = <K extends keyof ScriptTemplateInput>(k: K, v: ScriptTemplateInput[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{('id' in initial) ? 'Editar Script' : 'Novo Script'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Follow-up após 7 dias" />
            </div>
            <div className="flex items-end gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_default} onCheckedChange={v => set('is_default', v)} />
                <Label>Padrão</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Quando usar este script..." />
          </div>

          <div className="bg-muted/30 rounded p-3 text-xs">
            <strong>Placeholders disponíveis:</strong>{' '}
            <code>{'{firstName}'}</code>, <code>{'{contactName}'}</code>, <code>{'{sdrName}'}</code>,{' '}
            <code>{'{company}'}</code>, <code>{'{value}'}</code>, <code>{'{proposalRef}'}</code>,{' '}
            <code>{'{leadCode}'}</code>, <code>{'{proposalDate}'}</code>, <code>{'{expectedClosing}'}</code>,{' '}
            <code>{'{validityDays}'}</code>, <code>{'{proposalDesc}'}</code>
          </div>

          <div>
            <Label>1️⃣ Abertura</Label>
            <Textarea rows={3} value={form.opening} onChange={e => set('opening', e.target.value)} />
          </div>

          {/* Perguntas */}
          <div>
            <div className="flex items-center justify-between">
              <Label>2️⃣ Perguntas de Descoberta</Label>
              <Button size="sm" variant="outline" onClick={() => set('discovery_questions', [...form.discovery_questions, ''])}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2 mt-2">
              {form.discovery_questions.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-sm font-semibold pt-2 w-6">{i + 1}.</span>
                  <Textarea
                    rows={2}
                    value={q}
                    onChange={e => {
                      const next = [...form.discovery_questions]
                      next[i] = e.target.value
                      set('discovery_questions', next)
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={() => set('discovery_questions', form.discovery_questions.filter((_, j) => j !== i))}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Objeções */}
          <div>
            <div className="flex items-center justify-between">
              <Label>3️⃣ Quebra de Objeções</Label>
              <Button size="sm" variant="outline" onClick={() => set('objections', [...form.objections, { obj: '', resp: '' }])}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2 mt-2">
              {form.objections.map((o, i) => (
                <div key={i} className="border rounded p-2 space-y-2">
                  <div className="flex gap-2 items-start">
                    <Input
                      placeholder="Objeção (ex: Preço alto)"
                      value={o.obj}
                      onChange={e => {
                        const next = [...form.objections]
                        next[i] = { ...next[i], obj: e.target.value }
                        set('objections', next)
                      }}
                    />
                    <Button size="sm" variant="ghost" onClick={() => set('objections', form.objections.filter((_, j) => j !== i))}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Resposta sugerida..."
                    value={o.resp}
                    onChange={e => {
                      const next = [...form.objections]
                      next[i] = { ...next[i], resp: e.target.value }
                      set('objections', next)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>4️⃣ Fechamento</Label>
            <Textarea rows={3} value={form.closing} onChange={e => set('closing', e.target.value)} />
          </div>

          <div>
            <Label>5️⃣ Mensagem de Follow-up por WhatsApp</Label>
            <Textarea rows={3} value={form.whatsapp_followup} onChange={e => set('whatsapp_followup', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!form.name.trim()) return toast.error('Informe o nome do script.')
              onSave(form)
            }}
          >
            <Save className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
