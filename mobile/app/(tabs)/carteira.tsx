import { useState } from 'react'
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
import { fetchMinhaCarteira, liberarLead } from '../../src/services/pipeline'
import { fetchHistoricoLead } from '../../src/services/call-logs'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTelefonia } from '../../src/contexts/TelefoniaContext'
import { formatCurrency, formatDate, corTemperatura, corPrioridade } from '../../src/lib/utils'
import type { CrmPipeline, Temperature, Priority } from '../../src/types/crm'
import { TEMPERATURE_OPTIONS } from '../../src/types/crm'
import { corTemperatura as _ct } from '../../src/lib/utils'

const PRIORIDADES: Priority[] = ['Alta', 'Média', 'Baixa']

export default function CarteiraScreen() {
  const { userId, userName } = useAuth()
  const { ligar } = useTelefonia()
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [tempFiltro, setTempFiltro] = useState<Temperature | null>(null)
  const [prioFiltro, setPrioFiltro] = useState<Priority | null>(null)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['minha-carteira', userId],
    queryFn: () => fetchMinhaCarteira(userId),
    enabled: !!userId,
  })

  const { data: historico } = useQuery({
    queryKey: ['historico', expandidoId],
    queryFn: () => fetchHistoricoLead(expandidoId!),
    enabled: !!expandidoId,
  })

  const filtrado = (data ?? []).filter(l => {
    const matchBusca = l.client_name.toLowerCase().includes(busca.toLowerCase())
    const matchTemp = !tempFiltro || l.temperature === tempFiltro
    const matchPrio = !prioFiltro || l.priority === prioFiltro
    return matchBusca && matchTemp && matchPrio
  })

  async function onRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  async function handleDevolver(lead: CrmPipeline) {
    Alert.alert('Devolver lead?', `${lead.client_name} voltará ao banco de leads.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Devolver',
        style: 'destructive',
        onPress: async () => {
          await liberarLead(lead.id)
          qc.invalidateQueries({ queryKey: ['minha-carteira'] })
        },
      },
    ])
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0F2D5E" />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>💼 Minha Carteira</Text>
        <Text style={s.headerSub}>{filtrado.length} leads ativos</Text>
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar cliente..."
          placeholderTextColor="#94A3B8"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filtros */}
      <View style={s.filtrosWrap}>
        <View style={s.filtroRow}>
          {TEMPERATURE_OPTIONS.map(t => {
            const cor = corTemperatura(t)
            const ativo = tempFiltro === t
            return (
              <TouchableOpacity
                key={t}
                style={[s.filtroBtn, { borderColor: cor }, ativo && { backgroundColor: cor }]}
                onPress={() => setTempFiltro(ativo ? null : t)}
              >
                <Text style={[s.filtroBtnText, ativo && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            )
          })}
          {PRIORIDADES.map(p => {
            const cor = corPrioridade(p)
            const ativo = prioFiltro === p
            return (
              <TouchableOpacity
                key={p}
                style={[s.filtroBtn, { borderColor: cor }, ativo && { backgroundColor: cor }]}
                onPress={() => setPrioFiltro(ativo ? null : p)}
              >
                <Text style={[s.filtroBtnText, ativo && { color: '#fff' }]}>{p}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <FlatList
        data={filtrado}
        keyExtractor={i => i.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F2D5E" />
        }
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text style={s.empty}>Nenhum lead na sua carteira ainda.</Text>
        }
        renderItem={({ item }) => {
          const expandido = expandidoId === item.id
          const corTemp = corTemperatura(item.temperature)
          const dias = item.days_without_contact ?? 0

          return (
            <TouchableOpacity
              style={[s.card, { borderLeftColor: corTemp }]}
              onPress={() => setExpandidoId(expandido ? null : item.id)}
              activeOpacity={0.8}
            >
              {/* Linha principal */}
              <View style={s.cardTop}>
                <View style={s.cardInfo}>
                  <Text style={s.clientName} numberOfLines={1}>
                    {item.client_name}
                  </Text>
                  <Text style={s.cardSub}>
                    {item.proposal_number} · {item.state ?? ''}
                  </Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={s.cardValor}>{formatCurrency(item.value)}</Text>
                  <Text
                    style={[s.diasSemContato, dias > 10 && s.diasAlerta]}
                  >
                    {dias > 0 ? `${dias}d sem contato` : 'Contatado hoje'}
                  </Text>
                </View>
              </View>

              {/* Badges */}
              <View style={s.badges}>
                <View style={[s.badge, { backgroundColor: corTemp + '22' }]}>
                  <Text style={[s.badgeText, { color: corTemp }]}>
                    {item.temperature}
                  </Text>
                </View>
                <View
                  style={[
                    s.badge,
                    { backgroundColor: corPrioridade(item.priority) + '22' },
                  ]}
                >
                  <Text
                    style={[
                      s.badgeText,
                      { color: corPrioridade(item.priority) },
                    ]}
                  >
                    {item.priority}
                  </Text>
                </View>
                <View style={[s.badge, { backgroundColor: '#F1F5F9' }]}>
                  <Text style={[s.badgeText, { color: '#64748B' }]} numberOfLines={1}>
                    {item.sdr_status}
                  </Text>
                </View>
              </View>

              {/* Expandido */}
              {expandido && (
                <View style={s.expandido}>
                  {/* Contato */}
                  {item.contact_name && (
                    <Text style={s.contatoNome}>👤 {item.contact_name}</Text>
                  )}
                  {item.contact_mobile && (
                    <Text style={s.contatoInfo}>📱 {item.contact_mobile}</Text>
                  )}
                  {item.contact_phone && (
                    <Text style={s.contatoInfo}>☎️ {item.contact_phone}</Text>
                  )}
                  {item.contact_email && (
                    <Text style={s.contatoInfo}>✉️ {item.contact_email}</Text>
                  )}

                  {/* Botões de ação */}
                  <View style={s.acoes}>
                    {item.contact_mobile && (
                      <>
                        <TouchableOpacity
                          style={[s.acaoBtn, { backgroundColor: '#0F2D5E' }]}
                          onPress={() =>
                            ligar({
                              pipelineId: item.id,
                              sdrId: userId,
                              sdrName: userName,
                              numero: item.contact_mobile!,
                              tipo: 'celular',
                              clientName: item.client_name,
                            })
                          }
                        >
                          <Text style={s.acaoBtnText}>📞 Celular</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.acaoBtn, { backgroundColor: '#16A34A' }]}
                          onPress={() =>
                            ligar({
                              pipelineId: item.id,
                              sdrId: userId,
                              sdrName: userName,
                              numero: item.contact_mobile!,
                              tipo: 'whatsapp',
                              clientName: item.client_name,
                            })
                          }
                        >
                          <Text style={s.acaoBtnText}>💬 WhatsApp</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {item.contact_phone && (
                      <TouchableOpacity
                        style={[s.acaoBtn, { backgroundColor: '#475569' }]}
                        onPress={() =>
                          ligar({
                            pipelineId: item.id,
                            sdrId: userId,
                            sdrName: userName,
                            numero: item.contact_phone!,
                            tipo: 'fixo',
                            clientName: item.client_name,
                          })
                        }
                      >
                        <Text style={s.acaoBtnText}>☎️ Fixo</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[s.acaoBtn, { backgroundColor: '#DC2626' }]}
                      onPress={() => handleDevolver(item)}
                    >
                      <Text style={s.acaoBtnText}>↩️ Devolver</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Histórico */}
                  {(historico ?? []).length > 0 && (
                    <View style={s.historico}>
                      <Text style={s.historicoTitulo}>Histórico de ligações</Text>
                      {(historico ?? []).slice(0, 5).map(h => (
                        <View key={h.id} style={s.historicoItem}>
                          <Text style={s.historicoData}>
                            {formatDate(h.call_date)}
                          </Text>
                          <Text style={s.historicoResult} numberOfLines={1}>
                            {h.result ?? 'Sem resultado'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#0F2D5E', padding: 20, paddingTop: 56 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  searchWrap: { padding: 12, paddingBottom: 0 },
  filtrosWrap: { paddingHorizontal: 12, paddingTop: 8 },
  filtroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filtroBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 16, borderWidth: 1.5,
  },
  filtroBtnText: { fontSize: 11, fontWeight: '600', color: '#374151' },
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
  list: { padding: 12, gap: 10 },
  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 14, paddingVertical: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 8 },
  cardInfo: { flex: 1, minWidth: 0 },
  clientName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardValor: { fontSize: 15, fontWeight: '700', color: '#1A56DB' },
  diasSemContato: { fontSize: 11, color: '#64748B', marginTop: 3 },
  diasAlerta: { color: '#DC2626', fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  expandido: { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#F1F5F9', paddingTop: 14 },
  contatoNome: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 4 },
  contatoInfo: { fontSize: 13, color: '#475569', marginBottom: 3 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  acaoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acaoBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  historico: { marginTop: 14 },
  historicoTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  historicoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  historicoData: { fontSize: 12, color: '#94A3B8' },
  historicoResult: { fontSize: 12, color: '#374151', fontWeight: '600', flex: 1, textAlign: 'right' },
})
