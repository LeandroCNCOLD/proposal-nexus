import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchProposalBank, lockLead, unlockLead, countMyLocks } from '@/modules/sdr/services'
import { useAuth } from '@/hooks/useAuth'
import { SDR_LOCK_LIMIT } from '@/modules/sdr/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Unlock, Briefcase } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/app/sdr/bank')({
  component: BankPage,
})

const TEMP_COLORS: Record<string, string> = {
  'Frio': 'bg-blue-100 text-blue-800',
  'Morno': 'bg-yellow-100 text-yellow-800',
  'Quente': 'bg-orange-100 text-orange-800',
  'Muito Quente': 'bg-red-100 text-red-800',
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}

function daysSince(d?: string | null) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

function ageBadgeClass(days: number | null) {
  if (days == null) return 'bg-muted text-muted-foreground'
  if (days <= 7) return 'bg-green-100 text-green-800'
  if (days <= 30) return 'bg-yellow-100 text-yellow-800'
  if (days <= 60) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

function BankPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [uf, setUf] = useState('')
  const [minValue, setMinValue] = useState('')
  const [temp, setTemp] = useState('')

  // Qualquer usuário autenticado pode pegar leads para sua carteira.
  const canPickLeads = !!user

  const sdrName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'SDR'

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['proposal-bank'],
    queryFn: () => fetchProposalBank(),
  })

  const { data: myLockCount = 0 } = useQuery({
    queryKey: ['my-lock-count', user?.id],
    queryFn: () => (user ? countMyLocks(user.id) : Promise.resolve(0)),
    enabled: !!user && canPickLeads,
  })

  const lockMut = useMutation({
    mutationFn: (id: string) => lockLead(id, user!.id, sdrName),
    onSuccess: () => {
      toast.success('Lead travado na sua carteira!')
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
      qc.invalidateQueries({ queryKey: ['my-lock-count'] })
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
    },
    onError: () => toast.error('Não foi possível travar — talvez outro SDR pegou antes.'),
  })

  const unlockMut = useMutation({
    mutationFn: (id: string) => unlockLead(id),
    onSuccess: () => {
      toast.success('Lead devolvido ao banco.')
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
      qc.invalidateQueries({ queryKey: ['my-lock-count'] })
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
    },
  })

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search) {
        const s = search.toLowerCase()
        if (!r.client_name?.toLowerCase().includes(s) && !r.lead_code?.toLowerCase().includes(s)) return false
      }
      if (uf && r.state !== uf.toUpperCase()) return false
      if (minValue && r.value < Number(minValue)) return false
      if (temp && r.temperature !== temp) return false
      return true
    })
  }, [rows, search, uf, minValue, temp])

  const atLimit = canPickLeads && myLockCount >= SDR_LOCK_LIMIT

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E]">Banco de Leads</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {rows.length} leads ativos
            {canPickLeads && <> · Você tem <strong>{myLockCount}/{SDR_LOCK_LIMIT}</strong> leads na carteira</>}
          </p>
        </div>
        {atLimit && (
          <Badge variant="destructive">Limite de {SDR_LOCK_LIMIT} leads atingido — devolva algum para pegar mais</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center bg-muted/30 p-3 rounded-md">
        <Input placeholder="Buscar cliente ou código" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
        <Input placeholder="UF" value={uf} onChange={e => setUf(e.target.value)} className="w-20" maxLength={2} />
        <Input placeholder="Valor mín." type="number" value={minValue} onChange={e => setMinValue(e.target.value)} className="w-32" />
        <select value={temp} onChange={e => setTemp(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">Todas temperaturas</option>
          <option value="Frio">Frio</option>
          <option value="Morno">Morno</option>
          <option value="Quente">Quente</option>
          <option value="Muito Quente">Muito Quente</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Cliente / Razão Social</th>
                <th className="px-3 py-2">Contato</th>
                <th className="px-3 py-2">UF</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Cadastro</th>
                <th className="px-3 py-2">Última interação</th>
                <th className="px-3 py-2 text-center">Dias aberto</th>
                <th className="px-3 py-2">Temp.</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const lockedByMe = r.locked_by_sdr_id === user?.id
                const lockedByOther = !!r.locked_by_sdr_id && !lockedByMe
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/20 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{r.lead_code}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.client_name}</div>
                      {r.razao_social && r.razao_social !== r.client_name && (
                        <div className="text-xs text-muted-foreground">{r.razao_social}</div>
                      )}
                      {r.cnpj && <div className="text-[10px] font-mono text-muted-foreground">{r.cnpj}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{r.contact_name || '—'}</div>
                      <div className="text-muted-foreground font-mono">{r.contact_mobile || r.contact_phone || '—'}</div>
                    </td>
                    <td className="px-3 py-2">{r.state || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtBRL(r.value)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(r.proposal_date || r.created_at)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      <div>{fmtDate(r.last_contact_at)}</div>
                      {r.days_without_contact != null && (
                        <div className="text-[10px] text-muted-foreground">há {r.days_without_contact}d</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {(() => {
                        const d = daysSince(r.proposal_date || r.created_at)
                        return (
                          <Badge className={ageBadgeClass(d)} variant="secondary">
                            {d == null ? '—' : `${d}d`}
                          </Badge>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={TEMP_COLORS[r.temperature] || ''} variant="secondary">{r.temperature}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {lockedByMe && (
                        <Badge className="bg-blue-100 text-blue-800">
                          <Briefcase className="w-3 h-3 mr-1" />Minha carteira
                        </Badge>
                      )}
                      {lockedByOther && (
                        <div className="space-y-1">
                          <Badge className="bg-orange-100 text-orange-800">
                            <Lock className="w-3 h-3 mr-1" />Em atendimento
                          </Badge>
                          <div className="text-[11px] font-medium text-orange-900">
                            {r.locked_by_sdr_name || 'Outro usuário'}
                          </div>
                        </div>
                      )}
                      {!r.locked_by_sdr_id && <Badge variant="outline" className="text-green-700 border-green-300">Livre</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canPickLeads && !r.locked_by_sdr_id && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={atLimit || lockMut.isPending}
                          onClick={() => lockMut.mutate(r.id)}
                          title={atLimit ? `Limite de ${SDR_LOCK_LIMIT} atingido` : 'Pegar lead'}
                        >
                          <Lock className="w-3 h-3 mr-1" /> Pegar
                        </Button>
                      )}
                      {lockedByMe && (
                        <Button size="sm" variant="outline" onClick={() => unlockMut.mutate(r.id)}>
                          <Unlock className="w-3 h-3 mr-1" /> Devolver
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma lead encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
