import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Fragment, useMemo, useState } from 'react'
import { fetchProposalBank, lockLead, unlockLead, countMyLocks, freezeLead, MANAGER_FREEZE_PREFIX } from '@/modules/sdr/services'
import { useAuth } from '@/hooks/useAuth'
import { SDR_LOCK_LIMIT } from '@/modules/sdr/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Unlock, Briefcase, ShieldAlert, ArrowUp, ArrowDown, ArrowUpDown, FileText, Mail, ChevronRight, ChevronDown, AlertTriangle, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { useProposalLeadMatches } from '@/hooks/use-proposal-lead-matches'
import { useSdrNames, useCloserNames } from '@/modules/sdr/hooks/use-team-members'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useServerFn } from '@tanstack/react-start'
import { enqueueRemarketing } from '@/lib/remarketing.functions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const ARCHIVED_SDR_STATUSES = ['Perdido (com motivo)', 'Kill / Arquivar']
const ACTIVE_EXCLUDE = [...ARCHIVED_SDR_STATUSES, 'Fechado']
const TEMP_PRIORITY = ['Frio', 'Morno', 'Quente', 'Muito Quente']

const normalizeCnpj = (cnpj?: string | null) => (cnpj ?? '').replace(/\D/g, '')

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
  const [sdrFilter, setSdrFilter] = useState('')
  const [closerFilter, setCloserFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'mine' | 'others' | 'frozen'>('all')
  const [proposalStatusFilter, setProposalStatusFilter] = useState('')
  const [tab, setTab] = useState<'banco' | 'arquivados'>('banco')
  const { names: sdrNames } = useSdrNames()
  const { names: closerNames } = useCloserNames()
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [expandedCnpjs, setExpandedCnpjs] = useState<Set<string>>(new Set())
  const [returnConfirmCnpj, setReturnConfirmCnpj] = useState<string | null>(null)
  const toggleExpand = (cnpj: string) => {
    setExpandedCnpjs((prev) => {
      const next = new Set(prev)
      if (next.has(cnpj)) next.delete(cnpj); else next.add(cnpj)
      return next
    })
  }
  const enqueueRemarketingFn = useServerFn(enqueueRemarketing)
  const remarketingMut = useMutation({
    mutationFn: (id: string) => enqueueRemarketingFn({ data: { source: 'sdr', lead_id: id } }),
    onSuccess: () => { toast.success('Enviado para fila de remarketing'); qc.invalidateQueries({ queryKey: ['remarketing'] }) },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro'),
  })

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
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
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
    onError: (e) => {
      // Mostra a mensagem real do RPC (ex.: "Lead já está na carteira de outro SDR" / "Lead bloqueado pelo gestor")
      const msg = e instanceof Error ? e.message : 'Não foi possível travar este lead.'
      toast.error(msg)
      // Atualiza a lista para refletir o lock real e remover o botão "Pegar"
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
    },
  })

  const unlockMut = useMutation({
    mutationFn: (id: string) => unlockLead(id),
    onSuccess: () => {
      toast.success('Lead devolvido ao banco.')
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
      qc.invalidateQueries({ queryKey: ['my-lock-count'] })
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : 'Não foi possível devolver o lead.'
      toast.error(msg)
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
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

  const bulkPickMut = useMutation({
    mutationFn: async (ids: string[]) => {
      let ok = 0
      let failed = 0
      let stoppedByLimit = false
      let current = myLockCount
      for (const id of ids) {
        if (current >= SDR_LOCK_LIMIT) { stoppedByLimit = true; break }
        try {
          await lockLead(id, user!.id, sdrName)
          ok++
          current++
        } catch {
          failed++
        }
      }
      return { ok, failed, stoppedByLimit, total: ids.length }
    },
    onSuccess: (r) => {
      if (r.ok === r.total) {
        toast.success(`${r.ok} propostas adicionadas à sua carteira`)
      } else if (r.stoppedByLimit) {
        toast.warning(`Adicionei ${r.ok} de ${r.total} — limite de ${SDR_LOCK_LIMIT} leads atingido`)
      } else if (r.failed > 0) {
        toast.warning(`Adicionei ${r.ok} de ${r.total} — ${r.failed} não puderam ser travadas`)
      } else {
        toast.success(`${r.ok} propostas adicionadas à sua carteira`)
      }
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
      qc.invalidateQueries({ queryKey: ['my-lock-count'] })
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao pegar leads em massa'),
  })

  const bulkReturnMut = useMutation({
    mutationFn: async (ids: string[]) => {
      let ok = 0
      let failed = 0
      for (const id of ids) {
        try {
          await unlockLead(id)
          ok++
        } catch {
          failed++
        }
      }
      return { ok, failed, total: ids.length }
    },
    onSuccess: (r) => {
      if (r.failed === 0) {
        toast.success(`${r.ok} proposta${r.ok === 1 ? '' : 's'} devolvida${r.ok === 1 ? '' : 's'} ao banco`)
      } else {
        toast.warning(`Devolvidas ${r.ok} de ${r.total} (${r.failed} erros)`)
      }
      setReturnConfirmCnpj(null)
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
      qc.invalidateQueries({ queryKey: ['my-lock-count'] })
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Falha ao devolver leads em massa')
      setReturnConfirmCnpj(null)
    },
  })

  // Extrai base CN##### e revisão a partir do lead_code/proposal_title/proposal_version
  const parseRev = (r: any): { base: string; rev: number } => {
    const raw = String(r.lead_code ?? '').trim()
    const titleRaw = String(r.proposal_title ?? '').trim()
    const mRev = raw.match(/Rev\.?\s*(\d+)/i) ?? titleRaw.match(/Rev\.?\s*(\d+)/i)
    const rev = mRev ? parseInt(mRev[1], 10) : (Number(r.proposal_version) || 0)
    const base = raw.replace(/\s*Rev\.?\s*\d+\s*$/i, '').trim() || raw
    return { base, rev }
  }

  // Agrupa por base CN e marca a revisão mais recente de cada grupo.
  // Mostra todas as revisões (com badge), mas relatórios somam apenas a última.
  const withRevisions = useMemo(() => {
    const latest = new Map<string, number>()
    const counts = new Map<string, number>()
    rows.forEach(r => {
      const { base, rev } = parseRev(r)
      counts.set(base, (counts.get(base) ?? 0) + 1)
      const cur = latest.get(base)
      if (cur == null || rev > cur) latest.set(base, rev)
    })
    return rows.map(r => {
      const { base, rev } = parseRev(r)
      return {
        ...r,
        _revBase: base,
        _rev: rev,
        _revTotal: counts.get(base) ?? 1,
        _isLatestRev: rev === (latest.get(base) ?? rev),
      } as any
    })
  }, [rows])

  const filtered = useMemo(() => {
    return withRevisions.filter(r => {
      const isArchived = ARCHIVED_SDR_STATUSES.includes((r as any).sdr_status)
      if (tab === 'banco' && isArchived) return false
      if (tab === 'arquivados' && !isArchived) return false
      if (search) {
        const s = search.toLowerCase()
        if (!r.client_name?.toLowerCase().includes(s) && !r.lead_code?.toLowerCase().includes(s)) return false
      }
      if (uf && r.state !== uf.toUpperCase()) return false
      if (minValue && r.value < Number(minValue)) return false
      if (temp && r.temperature !== temp) return false
      if (sdrFilter) {
        const lockName = r.locked_by_sdr_name?.replace(MANAGER_FREEZE_PREFIX, '').replace(/^\s*\(|\)\s*$/g, '') ?? ''
        if (r.sdr_name !== sdrFilter && lockName !== sdrFilter) return false
      }
      if (closerFilter && r.closer_name !== closerFilter) return false
      if (statusFilter !== 'all') {
        const frozen = !!r.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX)
        if (statusFilter === 'frozen' && !frozen) return false
        if (statusFilter === 'available' && (r.locked_by_sdr_id || frozen)) return false
        if (statusFilter === 'mine' && r.locked_by_sdr_id !== user?.id) return false
        if (statusFilter === 'others' && (!r.locked_by_sdr_id || r.locked_by_sdr_id === user?.id || frozen)) return false
      }
      if (proposalStatusFilter && (r as any).proposal_status !== proposalStatusFilter) return false
      return true
    })
  }, [withRevisions, tab, search, uf, minValue, temp, sdrFilter, closerFilter, statusFilter, proposalStatusFilter, user?.id])

  // Resumo: conta apenas a última revisão de cada base CN para não inflar totais.
  const summary = useMemo(() => {
    const seen = new Set<string>()
    let totalValue = 0
    let uniqueCount = 0
    for (const r of filtered as any[]) {
      if (!r._isLatestRev) continue
      if (seen.has(r._revBase)) continue
      seen.add(r._revBase)
      uniqueCount++
      totalValue += Number(r.value ?? 0)
    }
    return { uniqueCount, totalValue }
  }, [filtered])

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

  // Agrupamento por CNPJ — sempre ativo
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>()
    const ungrouped: any[] = []
    for (const r of filtered as any[]) {
      const k = normalizeCnpj(r.cnpj)
      if (!k) { ungrouped.push(r); continue }
      const arr = map.get(k) ?? []
      arr.push(r)
      map.set(k, arr)
    }
    const groups = Array.from(map.entries()).map(([cnpjKey, leads]) => {
      const first = leads[0] as any
      const totalValue = leads.reduce((s, l) => s + Number(l.value ?? 0), 0)
      const latestValue = leads
        .filter((l: any) => l._isLatestRev)
        .reduce((s: number, l: any) => s + Number(l.value ?? 0), 0)
      const tempIdx = leads.reduce((mx: number, l: any) => {
        const i = TEMP_PRIORITY.indexOf(l.temperature)
        return i > mx ? i : mx
      }, -1)
      const hottestTemp = tempIdx >= 0 ? TEMP_PRIORITY[tempIdx] : null
      const latestProposal = leads.reduce((acc: string | null, l: any) => {
        const d = l.proposal_date || l.created_at
        if (!d) return acc
        if (!acc || new Date(d) > new Date(acc)) return d
        return acc
      }, null as string | null)
      const lastInteraction = leads.reduce((acc: string | null, l: any) => {
        const d = l.last_contact_at
        if (!d) return acc
        if (!acc || new Date(d) > new Date(acc)) return d
        return acc
      }, null as string | null)
      const lockedLeads = leads.filter((l: any) => l.locked_by_sdr_id && !l.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX))
      const firstLockName = lockedLeads[0]?.locked_by_sdr_name ?? null
      const activeLeads = leads.filter((l: any) => !ACTIVE_EXCLUDE.includes(l.sdr_status))
      const activeCount = activeLeads.length
      const hasMine = leads.some((l: any) => l.locked_by_sdr_id === user?.id)
      const pickableIds = activeLeads
        .filter((l: any) => !l.locked_by_sdr_id)
        .map((l: any) => l.id as string)
      // Propostas minhas ativas — passíveis de devolução em massa
      const returnableIds = leads
        .filter((l: any) => l.locked_by_sdr_id === user?.id && !ACTIVE_EXCLUDE.includes(l.sdr_status))
        .map((l: any) => l.id as string)
      return {
        cnpj: cnpjKey,
        cnpjDisplay: first.cnpj || cnpjKey,
        razao_social: first.razao_social || first.client_name,
        client_name: first.client_name,
        state: first.state,
        leads,
        count: leads.length,
        activeCount,
        totalValue,
        latestValue,
        hottestTemp,
        latestProposal,
        lastInteraction,
        lockedCount: lockedLeads.length,
        firstLockName,
        hasMine,
        pickableIds,
        returnableIds,
      }
    })
    groups.sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
    return { groups, ungrouped }
  }, [filtered, user?.id])

  const returnConfirmGroup = useMemo(
    () => returnConfirmCnpj ? grouped.groups.find(g => g.cnpj === returnConfirmCnpj) ?? null : null,
    [returnConfirmCnpj, grouped.groups],
  )

  const atLimit = canPickLeads && myLockCount >= SDR_LOCK_LIMIT

  const frozenLeads = useMemo(
    () => rows.filter(r => !!r.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX)),
    [rows],
  )
  const [showFrozen, setShowFrozen] = useState(false)

  const renderLeadRow = (r: any) => {
    const lockedByMe = r.locked_by_sdr_id === user?.id
    const lockedByOther = !!r.locked_by_sdr_id && !lockedByMe
    const isFrozen = !!r.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX)
    return (
      <tr key={r.id} className="border-t hover:bg-muted/20 align-top">
        <td className="px-3 py-2 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <Link
              to="/app/sdr/leads/$id"
              params={{ id: r.id }}
              className="text-primary hover:underline"
              title="Abrir detalhes e histórico do SDR"
            >
              {r.lead_code}
            </Link>
            {r._revTotal > 1 && (
              <Badge
                variant="secondary"
                className={r._isLatestRev ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
                title={r._isLatestRev
                  ? `Última revisão (${r._revTotal} no total). Valor contado no relatório.`
                  : `Revisão anterior — não somada no relatório. Última: Rev. ${String((r._revTotal)).padStart(2,'0')}`}
              >
                Rev. {String(r._rev).padStart(2, '0')} · {r._revTotal}
              </Badge>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="font-semibold">{r.client_name}</div>
          {r.razao_social && r.razao_social !== r.client_name && (
            <div className="text-xs text-muted-foreground">{r.razao_social}</div>
          )}
          {r.cnpj && <div className="text-[10px] font-mono text-muted-foreground">{r.cnpj}</div>}
          {(() => {
            const m = nomusByLead.get(r.id)
            if (!m) return null
            return (
              <Link
                to="/app/propostas/$id"
                params={{ id: m.proposal_id }}
                className="inline-flex items-center gap-1 mt-1"
                title={m.match_type === 'cnpj' ? 'Match por CNPJ' : 'Match por título'}
              >
                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                  <FileText className="w-3 h-3 mr-1" />Proposta Nomus
                </Badge>
              </Link>
            )
          })()}
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
        <td className="px-3 py-2 text-xs">
          {(() => {
            const ps = (r as any).proposal_status as string | null | undefined
            if (!ps) return <span className="text-muted-foreground">—</span>
            const map: Record<string, string> = {
              'Proposta Criada': 'bg-slate-100 text-slate-800',
              'Proposta Enviada': 'bg-blue-100 text-blue-800',
              'Negociando': 'bg-amber-100 text-amber-800',
              'Prorrogadas': 'bg-purple-100 text-purple-800',
              'Aprovadas': 'bg-green-100 text-green-800',
              'Perdidas': 'bg-red-100 text-red-800',
              'Canceladas': 'bg-zinc-200 text-zinc-800',
            }
            return <Badge className={map[ps] || 'bg-muted text-foreground'} variant="secondary">{ps}</Badge>
          })()}
        </td>
        <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
          {tab === 'arquivados' ? (
            <Button size="sm" variant="outline" disabled={remarketingMut.isPending}
              onClick={() => remarketingMut.mutate(r.id)}>
              <Mail className="w-3 h-3 mr-1" /> Remarketing
            </Button>
          ) : (
            <>
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
            </>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 border-b">
        <button type="button" onClick={() => setTab('banco')}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === 'banco' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Banco</button>
        <button type="button" onClick={() => setTab('arquivados')}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === 'arquivados' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Arquivados (perdidos/kill)</button>
        <Link to="/app/marketing/remarketing" className="ml-auto text-xs text-primary hover:underline">Fila de remarketing →</Link>
      </div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E]">Banco de Leads</h1>
          <p className="text-sm text-muted-foreground">
            <><strong>{grouped.groups.length}</strong> empresas · {filtered.length} propostas · <strong>{fmtBRL(grouped.groups.reduce((s, g) => s + g.totalValue, 0))}</strong></>

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
        <Select value={sdrFilter || '__all__'} onValueChange={v => setSdrFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="SDR" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos SDRs</SelectItem>
            {sdrNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={closerFilter || '__all__'} onValueChange={v => setCloserFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Closer / Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos Closers</SelectItem>
            {closerNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Carteira" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda carteira</SelectItem>
            <SelectItem value="available">Disponíveis</SelectItem>
            <SelectItem value="mine">Minha carteira</SelectItem>
            <SelectItem value="others">De outros SDRs</SelectItem>
            <SelectItem value="frozen">Bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={proposalStatusFilter || '__all__'} onValueChange={v => setProposalStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status proposta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos status</SelectItem>
            <SelectItem value="Proposta Criada">Criada</SelectItem>
            <SelectItem value="Proposta Enviada">Enviada</SelectItem>
            <SelectItem value="Negociando">Negociando</SelectItem>
            <SelectItem value="Prorrogadas">Prorrogada</SelectItem>
            <SelectItem value="Aprovadas">Ganha (Aprovada)</SelectItem>
            <SelectItem value="Perdidas">Perdida</SelectItem>
            <SelectItem value="Canceladas">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        {(search || uf || minValue || temp || sdrFilter || closerFilter || statusFilter !== 'all' || proposalStatusFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setUf(''); setMinValue(''); setTemp(''); setSdrFilter(''); setCloserFilter(''); setStatusFilter('all'); setProposalStatusFilter('') }}>
            Limpar filtros
          </Button>
        )}
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
                <SortableTh label="Atendimento" sk="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2">Status Proposta</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {!groupByCnpj && sorted.map((r) => renderLeadRow(r))}
              {!groupByCnpj && filtered.length === 0 && (
                <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">Nenhuma lead encontrada</td></tr>
              )}

              {groupByCnpj && grouped.groups.map((g) => {
                const isOpen = expandedCnpjs.has(g.cnpj)
                const dupRisk = g.activeCount >= 3
                const canBulk = canPickLeads && !g.hasMine && g.pickableIds.length > 0 && !atLimit && tab !== 'arquivados'
                const remaining = SDR_LOCK_LIMIT - myLockCount
                const willPick = Math.min(g.pickableIds.length, Math.max(0, remaining))
                return (
                  <Fragment key={g.cnpj}>
                    <tr
                      className="border-t bg-muted/40 hover:bg-muted/60 cursor-pointer font-medium"
                      onClick={() => toggleExpand(g.cnpj)}
                    >
                      <td className="px-3 py-2" colSpan={2}>
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{g.razao_social || g.client_name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{g.cnpjDisplay}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <Badge className="bg-primary/10 text-primary" variant="secondary">
                          {g.count} proposta{g.count === 1 ? '' : 's'}
                        </Badge>
                        {dupRisk && (
                          <div className="mt-1">
                            <Badge className="bg-orange-100 text-orange-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {g.activeCount} ativas
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">{g.state || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="font-semibold">{fmtBRL(g.totalValue)}</div>
                        {g.latestValue > 0 && g.latestValue !== g.totalValue && (
                          <div className="text-[10px] text-muted-foreground">última rev: {fmtBRL(g.latestValue)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(g.latestProposal)}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(g.lastInteraction)}</td>
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const d = daysSince(g.latestProposal)
                          return <Badge className={ageBadgeClass(d)} variant="secondary">{d == null ? '—' : `${d}d`}</Badge>
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        {g.hottestTemp && <Badge className={TEMP_COLORS[g.hottestTemp] || ''} variant="secondary">{g.hottestTemp}</Badge>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {g.lockedCount > 0 ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-orange-100 text-orange-800">
                              <Lock className="w-3 h-3 mr-1" />Em atendimento
                            </Badge>
                            <div className="text-[10px] text-orange-900">
                              {g.firstLockName}{g.lockedCount > 1 && ` +${g.lockedCount - 1}`}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-green-700 border-green-300">Livre</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">—</td>
                      <td className="px-3 py-2 text-right">
                        {canBulk && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={bulkPickMut.isPending}
                            onClick={(e) => {
                              e.stopPropagation()
                              const msg = willPick < g.pickableIds.length
                                ? `Pegar ${willPick} de ${g.pickableIds.length} propostas ativas? (limite de ${SDR_LOCK_LIMIT})`
                                : `Pegar todas as ${g.pickableIds.length} propostas ativas deste CNPJ?`
                              if (confirm(msg)) bulkPickMut.mutate(g.pickableIds)
                            }}
                            title={`Travar todas as ${g.pickableIds.length} propostas ativas deste cliente`}
                          >
                            <Lock className="w-3 h-3 mr-1" /> Pegar todas ({g.pickableIds.length})
                          </Button>
                        )}
                      </td>
                    </tr>
                    {isOpen && g.leads.map((l: any) => renderLeadRow(l))}
                  </Fragment>
                )
              })}

              {groupByCnpj && grouped.ungrouped.length > 0 && (
                <>
                  <tr className="border-t bg-amber-50">
                    <td colSpan={12} className="px-3 py-2 text-xs font-semibold text-amber-900">
                      Sem CNPJ — não agrupados ({grouped.ungrouped.length})
                    </td>
                  </tr>
                  {grouped.ungrouped.map((r) => renderLeadRow(r))}
                </>
              )}

              {groupByCnpj && grouped.groups.length === 0 && grouped.ungrouped.length === 0 && (
                <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">Nenhuma lead encontrada</td></tr>
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
