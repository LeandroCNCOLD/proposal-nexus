import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBancoLeads, travarLead } from '../../src/services/pipeline'
import { useAuth } from '../../src/contexts/AuthContext'
import {
  formatCurrency,
  corTemperatura,
  corPrioridade,
} from '../../src/lib/utils'
import type { CrmPipeline, Temperature, Priority } from '../../src/types/crm'
import { TEMPERATURE_OPTIONS } from '../../src/types/crm'

const PRIORIDADES: Priority[] = ['Alta', 'Média', 'Baixa']

export default function BancoLeadsScreen() {
  const { userId, userName } = useAuth()
  const qc = useQueryClient()

  const [busca, setBusca] = useState('')
  const [tempFiltro, setTempFiltro] = useState<Temperature | null>(null)
  const [prioFiltro, setPrioFiltro] = useState<Priority | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [travando, setTravando] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['banco-leads', busca, tempFiltro, prioFiltro],
    queryFn: () =>
      fetchBancoLeads({
        search: busca || undefined,
        temperature: tempFiltro ?? undefined,
        priority: prioFiltro ?? undefined,
      }),
    staleTime: 20_000,
  })

  async function onRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  async function handleTravar(lead: CrmPipeline) {
    Alert.alert(
      'Travar lead?',
      `${lead.client_name} (${formatCurrency(lead.value)}) vai para sua carteira por 7 dias.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Travar',
          onPress: async () => {
            setTravando(lead.id)
            try {
              await travarLead(lead.id, userId, userName)
              qc.invalidateQueries({ queryKey: ['banco-leads'] })
              qc.invalidateQueries({ queryKey: ['minha-carteira'] })
              Alert.alert('✅ Lead travado!', `${lead.client_name} está na sua carteira.`)
            } catch (e: any) {
              Alert.alert(
                'Não disponível',
                'Esse lead foi travado por outro SDR agora. Tente outro.'
              )
            } finally {
              setTravando(null)
            }
          },
        },
      ]
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🏦 Banco de Leads</Text>
        <Text style={s.headerSub}>
          {data?.length ?? 0} leads disponíveis
        </Text>
      </View>

      {/* Busca */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar empresa..."
          placeholderTextColor="#94A3B8"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* Filtros temperatura */}
      <View style={s.filtrosWrap}>
        <Text style={s.filtroLabel}>Temperatura:</Text>
        <View style={s.filtroRow}>
          {TEMPERATURE_OPTIONS.map(t => {
            const cor = corTemperatura(t)
            const ativo = tempFiltro === t
            return (
              <TouchableOpacity
                key={t}
                style={[
                  s.filtroBtn,
                  { borderColor: cor },
                  ativo && { backgroundColor: cor },
                ]}
                onPress={() => setTempFiltro(ativo ? null : t)}
              >
                <Text style={[s.filtroBtnText, ativo && { color: '#fff' }]}>
                  {t}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={[s.filtroLabel, { marginTop: 8 }]}>Prioridade:</Text>
        <View style={s.filtroRow}>
          {PRIORIDADES.map(p => {
            const cor = corPrioridade(p)
            const ativo = prioFiltro === p
            return (
              <TouchableOpacity
                key={p}
                style={[
                  s.filtroBtn,
                  { borderColor: cor },
                  ativo && { backgroundColor: cor },
                ]}
                onPress={() => setPrioFiltro(ativo ? null : p)}
              >
                <Text style={[s.filtroBtnText, ativo && { color: '#fff' }]}>
                  {p}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} size="large" color="#0F2D5E" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={i => i.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0F2D5E"
            />
          }
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <Text style={s.empty}>
              Nenhum lead livre com esses filtros.
            </Text>
          }
          renderItem={({ item }) => {
            const corTemp = corTemperatura(item.temperature)
            const corPrio = corPrioridade(item.priority)
            const isTravando = travando === item.id

            return (
              <View style={[s.card, { borderLeftColor: corTemp }]}>
                <View style={s.cardTop}>
                  <View style={s.cardInfo}>
                    <Text style={s.clientName} numberOfLines={1}>
                      {item.client_name}
                    </Text>
                    <Text style={s.cardSub}>
                      {item.proposal_number}
                      {item.city ? ` · ${item.city}/${item.state}` : ''}
                    </Text>
                  </View>
                  <Text style={s.valor}>{formatCurrency(item.value)}</Text>
                </View>

                <View style={s.badgeRow}>
                  <View style={[s.badge, { backgroundColor: corTemp + '22' }]}>
                    <Text style={[s.badgeText, { color: corTemp }]}>
                      {item.temperature}
                    </Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: corPrio + '22' }]}>
                    <Text style={[s.badgeText, { color: corPrio }]}>
                      {item.priority}
                    </Text>
                  </View>
                  {item.closer_name && (
                    <View style={[s.badge, { backgroundColor: '#F1F5F9' }]}>
                      <Text style={[s.badgeText, { color: '#475569' }]}>
                        Closer: {item.closer_name}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[s.btnTravar, isTravando && s.btnTravando]}
                  onPress={() => handleTravar(item)}
                  disabled={isTravando}
                >
                  {isTravando ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.btnTravarText}>🔒 Travar para mim</Text>
                  )}
                </TouchableOpacity>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0F2D5E', padding: 20, paddingTop: 56 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  searchWrap: { padding: 12, paddingBottom: 0 },
  search: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filtrosWrap: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filtroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  filtroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filtroBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  filtroBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  list: { padding: 12, gap: 10 },
  empty: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 14,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardInfo: { flex: 1, minWidth: 0 },
  clientName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  valor: { fontSize: 15, fontWeight: '700', color: '#1A56DB' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  btnTravar: {
    backgroundColor: '#0F2D5E',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  btnTravando: { opacity: 0.6 },
  btnTravarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
