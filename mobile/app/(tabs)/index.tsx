import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchDashboardKpis, fetchHotDeals } from '../../src/services/pipeline'
import { fetchMetricasTempoReal } from '../../src/services/call-logs'
import { formatCurrency } from '../../src/lib/utils'
import { useTelefonia } from '../../src/contexts/TelefoniaContext'
import { useAuth } from '../../src/contexts/AuthContext'

export default function WarRoomScreen() {
  const { userName, userId } = useAuth()
  const { ligar } = useTelefonia()
  const [refreshing, setRefreshing] = useState(false)

  const kpis = useQuery({
    queryKey: ['kpis'],
    queryFn: fetchDashboardKpis,
    refetchInterval: 60_000,
  })

  const hotDeals = useQuery({
    queryKey: ['hot-deals'],
    queryFn: () => fetchHotDeals(5),
    refetchInterval: 60_000,
  })

  const metricas = useQuery({
    queryKey: ['metricas-rt'],
    queryFn: fetchMetricasTempoReal,
    refetchInterval: 30_000,
  })

  async function onRefresh() {
    setRefreshing(true)
    await Promise.all([kpis.refetch(), hotDeals.refetch(), metricas.refetch()])
    setRefreshing(false)
  }

  const d = kpis.data
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <ScrollView
      style={s.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F2D5E" />
      }
    >
      <View style={s.header}>
        <Text style={s.headerTitle}>⚡ War Room</Text>
        <Text style={s.headerSub}>{hoje}</Text>
      </View>

      <View style={s.kpiGrid}>
        <KpiCard
          label="Pipeline Ativo"
          value={String(d?.totalAtivo ?? '—')}
          sub={formatCurrency(d?.valorTotal ?? 0)}
          cor="#1A56DB"
        />
        <KpiCard
          label="Quentes"
          value={String(d?.quentes ?? '—')}
          sub="precisam ação"
          cor="#D97706"
        />
        <KpiCard
          label="Sem contato >10d"
          value={String(d?.semContato10d ?? '—')}
          sub="prioridade alta"
          cor="#DC2626"
        />
        <KpiCard
          label="Ligações hoje"
          value={String(d?.ligacoesHoje ?? '—')}
          sub="registradas"
          cor="#16A34A"
        />
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Meta do dia — 15 contatos/SDR</Text>
        {(metricas.data ?? []).map((m: any) => {
          const pct = Math.min((m.concluidos / 15) * 100, 100)
          const cor =
            m.concluidos >= 15 ? '#16A34A' : m.concluidos >= 8 ? '#D97706' : '#DC2626'
          return (
            <View key={m.sdr_name} style={s.sdrRow}>
              <View style={[s.sdrAvatar, { backgroundColor: cor }]}>
                <Text style={s.sdrAvatarText}>{m.sdr_name.charAt(0)}</Text>
              </View>
              <View style={s.sdrInfo}>
                <View style={s.sdrTop}>
                  <Text style={s.sdrName}>{m.sdr_name}</Text>
                  <Text style={[s.sdrPct, { color: cor }]}>{m.concluidos}/15</Text>
                </View>
                <View style={s.barBg}>
                  <View
                    style={[
                      s.barFill,
                      { width: `${pct}%` as any, backgroundColor: cor },
                    ]}
                  />
                </View>
                <Text style={s.sdrSub}>
                  {m.tentativas} tentativas · {m.reunioes} reuniões
                </Text>
              </View>
            </View>
          )
        })}
        {(metricas.data ?? []).length === 0 && (
          <Text style={s.empty}>Nenhuma ligação registrada hoje ainda.</Text>
        )}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>🔥 Hot Leads — ação agora</Text>
        {(hotDeals.data ?? []).map(lead => (
          <View key={lead.id} style={s.hotCard}>
            <View style={s.hotInfo}>
              <Text style={s.hotClient} numberOfLines={1}>
                {lead.client_name}
              </Text>
              <Text style={s.hotMeta}>
                {lead.closer_name} · {lead.days_without_contact ?? 0}d sem contato
              </Text>
            </View>
            <View style={s.hotRight}>
              <Text style={s.hotValue}>{formatCurrency(lead.value)}</Text>
              {lead.contact_mobile && (
                <TouchableOpacity
                  style={s.hotBtn}
                  onPress={() =>
                    ligar({
                      pipelineId: lead.id,
                      sdrId: userId,
                      sdrName: userName,
                      numero: lead.contact_mobile!,
                      tipo: 'celular',
                      clientName: lead.client_name,
                    })
                  }
                >
                  <Text style={s.hotBtnText}>📞 Ligar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function KpiCard(props: { label: string; value: string; sub: string; cor: string }) {
  return (
    <View style={[s.kpi, { borderTopColor: props.cor }]}>
      <Text style={s.kpiLabel}>{props.label}</Text>
      <Text style={[s.kpiValue, { color: props.cor }]}>{props.value}</Text>
      <Text style={s.kpiSub}>{props.sub}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0F2D5E', padding: 20, paddingTop: 56 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  kpi: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  kpiValue: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  kpiSub: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  section: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F2D5E', marginBottom: 14 },
  sdrRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  sdrAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sdrAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sdrInfo: { flex: 1 },
  sdrTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  sdrName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  sdrPct: { fontSize: 13, fontWeight: '700' },
  barBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  sdrSub: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  hotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  hotInfo: { flex: 1, minWidth: 0 },
  hotClient: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  hotMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  hotRight: { alignItems: 'flex-end', gap: 6 },
  hotValue: { fontSize: 14, fontWeight: '700', color: '#1A56DB' },
  hotBtn: {
    backgroundColor: '#0F2D5E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hotBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 16 },
})
