import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchProposalBank, lockLead, unlockLead, countMyLocks, freezeLead, MANAGER_FREEZE_PREFIX } from '@/modules/sdr/services'
import { useAuth } from '@/hooks/useAuth'
import { SDR_LOCK_LIMIT } from '@/modules/sdr/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Unlock, Briefcase, ShieldAlert, ArrowUp, ArrowDown, ArrowUpDown, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { useProposalLeadMatches } from '@/hooks/use-proposal-lead-matches'

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

type SortKey = 'lead_code' | 'client_name' | 'contact_name' | 'state' | 'value' | 'cadastro' | 'last_contact_at' | 'days_open' | 'temperature' | 'status'
type SortDir = 'asc' | 'desc' | null

function BankPage() {
  const { user, hasAnyRole } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [uf, setUf] = useState('')
  const [minValue, setMinValue] = useState('')
  const [temp, setTemp] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return }
    if (sortDir === 'asc') { setSortDir('desc'); return }
    if (sortDir === 'desc') { setSortKey(null); setSortDir(null); return }
    setSortDir('asc')
  }

  // Qualquer usuário autenticado pode pegar leads para sua carteira.
  const canPickLeads = !!user
  const isManager = hasAnyRole(['gerente_comercial', 'diretoria', 'admin'])

  const sdrName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'SDR'

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['proposal-bank'],
    queryFn: () => fetchProposalBank(),
  })

  const { byLead: nomusByLead } = useProposalLeadMatches({
    leadIds: useMemo(() => rows.map(r => r.id), [rows]),
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

  const freezeMut = useMutation({
    mutationFn: (id: string) => freezeLead(id, user!.id, sdrName),
    onSuccess: () => {
      toast.success('Lead bloqueado — ninguém pode entrar em contato.')
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
    },
    onError: () => toast.error('Não foi possível bloquear o lead.'),
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

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered
    const tempOrder: Record<string, number> = { 'Frio': 0, 'Morno': 1, 'Quente': 2, 'Muito Quente': 3 }
    const statusVal = (r: any) => {
      const frozen = !!r.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX)
      if (frozen) return 3
      if (r.locked_by_sdr_id === user?.id) return 1
      if (r.locked_by_sdr_id) return 2
      return 0
    }
    const getVal = (r: any): string | number => {
      switch (sortKey) {
        case 'lead_code': return r.lead_code ?? ''
        case 'client_name': return (r.client_name ?? '').toLowerCase()
        case 'contact_name': return (r.contact_name ?? '').toLowerCase()
        case 'state': return r.state ?? ''
        case 'value': return r.value ?? 0
        case 'cadastro': return new Date(r.proposal_date || r.created_at || 0).getTime()
        case 'last_contact_at': return new Date(r.last_contact_at || 0).getTime()
        case 'days_open': return daysSince(r.proposal_date || r.created_at) ?? -1
        case 'temperature': return tempOrder[r.temperature] ?? -1
        case 'status': return statusVal(r)
      }
    }
    const copy = [...filtered]
    copy.sort((a, b) => {
      const va = getVal(a); const vb = getVal(b)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [filtered, sortKey, sortDir, user?.id])

  const atLimit = canPickLeads && myLockCount >= SDR_LOCK_LIMIT

  const frozenLeads = useMemo(
    () => rows.filter(r => !!r.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX)),
    [rows],
  )
  const [showFrozen, setShowFrozen] = useState(false)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E]">Banco de Leads</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {rows.length} leads ativos
            {canPickLeads && <> · Você tem <strong>{myLockCount}/{SDR_LOCK_LIMIT}</strong> leads na carteira</>}
            {' · '}
            <button
              type="button"
              onClick={() => setShowFrozen(true)}
              className="inline-flex items-center gap-1 text-red-700 hover:underline font-medium"
              title="Ver leads bloqueados"
            >
              <ShieldAlert className="w-3 h-3" />
              {frozenLeads.length} bloqueado{frozenLeads.length === 1 ? '' : 's'}
            </button>
          </p>
        </div>
        {atLimit && (
          <Badge variant="destructive">Limite de {SDR_LOCK_LIMIT} leads atingido — devolva algum para pegar mais</Badge>
        )}
      </div>

      {showFrozen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowFrozen(false)}>
          <div className="bg-background rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-bold text-[#0F2D5E] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Leads Bloqueados ({frozenLeads.length})
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setShowFrozen(false)}>Fechar</Button>
            </div>
            <div className="overflow-y-auto">
              {frozenLeads.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhum lead bloqueado.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2">Lead</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Bloqueado por</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      {isManager && <th className="px-3 py-2 text-right">Ação</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {frozenLeads.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{r.lead_code}</td>
                        <td className="px-3 py-2">{r.client_name}</td>
                        <td className="px-3 py-2 text-xs">{r.locked_by_sdr_name?.replace(MANAGER_FREEZE_PREFIX, '').replace(/^\s*\(|\)\s*$/g, '') || '—'}</td>
                        <td className="px-3 py-2 text-right">{fmtBRL(r.value)}</td>
                        {isManager && (
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => unlockMut.mutate(r.id)}>
                              <Unlock className="w-3 h-3 mr-1" /> Desbloquear
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}


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
                <SortableTh label="Lead" sk="lead_code" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Cliente / Razão Social" sk="client_name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Contato" sk="contact_name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="UF" sk="state" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Valor" sk="value" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Cadastro" sk="cadastro" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Última interação" sk="last_contact_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Dias aberto" sk="days_open" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="center" />
                <SortableTh label="Temp." sk="temperature" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Status" sk="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const lockedByMe = r.locked_by_sdr_id === user?.id
                const lockedByOther = !!r.locked_by_sdr_id && !lockedByMe
                const isFrozen = !!r.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX)
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
                      {isFrozen ? (
                        <Badge className="bg-red-100 text-red-800">
                          <ShieldAlert className="w-3 h-3 mr-1" />Bloqueado pelo gestor
                        </Badge>
                      ) : lockedByMe ? (
                        <Badge className="bg-blue-100 text-blue-800">
                          <Briefcase className="w-3 h-3 mr-1" />Minha carteira
                        </Badge>
                      ) : lockedByOther ? (
                        <div className="space-y-1">
                          <Badge className="bg-orange-100 text-orange-800">
                            <Lock className="w-3 h-3 mr-1" />Em atendimento
                          </Badge>
                          <div className="text-[11px] font-medium text-orange-900">
                            {r.locked_by_sdr_name || 'Outro usuário'}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-green-700 border-green-300">Livre</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
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
                      {lockedByMe && !isFrozen && (
                        <Button size="sm" variant="outline" onClick={() => unlockMut.mutate(r.id)}>
                          <Unlock className="w-3 h-3 mr-1" /> Devolver
                        </Button>
                      )}
                      {isManager && !isFrozen && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={freezeMut.isPending}
                          onClick={() => {
                            if (confirm('Bloquear este lead? Ninguém poderá entrar em contato até você desbloquear.')) {
                              freezeMut.mutate(r.id)
                            }
                          }}
                          title="Bloquear lead (gestor)"
                        >
                          <ShieldAlert className="w-3 h-3 mr-1" /> Bloquear
                        </Button>
                      )}
                      {isManager && isFrozen && (
                        <Button size="sm" variant="outline" onClick={() => unlockMut.mutate(r.id)}>
                          <Unlock className="w-3 h-3 mr-1" /> Desbloquear
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

function SortableTh({ label, sk, sortKey, sortDir, onClick, align }: {
  label: string
  sk: SortKey
  sortKey: SortKey | null
  sortDir: SortDir
  onClick: (k: SortKey) => void
  align?: 'left' | 'right' | 'center'
}) {
  const active = sortKey === sk && sortDir
  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown
  const alignClass = align === 'right' ? 'text-right justify-end' : align === 'center' ? 'text-center justify-center' : 'text-left justify-start'
  return (
    <th className={`px-3 py-2 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''}`}>
      <button
        type="button"
        onClick={() => onClick(sk)}
        className={`inline-flex items-center gap-1 hover:text-primary transition-colors ${alignClass} ${active ? 'text-primary font-semibold' : ''}`}
      >
        {label}
        <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    </th>
  )
}
