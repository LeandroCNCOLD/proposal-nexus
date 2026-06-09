import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../src/lib/supabase'
import { formatDate, formatTime } from '../../src/lib/utils'
import { useAuth } from '../../src/contexts/AuthContext'
import { CLOSER_NAMES } from '../../src/types/crm'
import type { CrmAgenda } from '../../src/types/crm'

async function fetchAgenda(filtro: 'hoje' | 'semana'): Promise<CrmAgenda[]> {
  const hoje = new Date().toISOString().slice(0, 10)
  const fimSemana = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const dataFim = filtro === 'hoje' ? hoje + 'T23:59:59' : fimSemana + 'T23:59:59'

  const { data, error } = await supabase
    .from('crm_agenda')
    .select('*')
    .gte('data_inicio', hoje + 'T00:00:00')
    .lte('data_inicio', dataFim)
    .order('data_inicio', { ascending: true })

  if (error) throw error
  return (data ?? []) as CrmAgenda[]
}

async function confirmarPresenca(agendaId: string): Promise<void> {
  const { error } = await supabase
    .from('crm_agenda')
    .update({ closer_confirmou: true, closer_confirmou_at: new Date().toISOString() })
    .eq('id', agendaId)
  if (error) throw error
}

async function criarReuniao(dados: {
  client_name: string
  tipo: string
  data_inicio: string
  data_fim: string
  closer_nome: string
  sdr_nome: string
  local?: string
  link_reuniao?: string
  observacoes?: string
}): Promise<void> {
  const { error } = await supabase.from('crm_agenda').insert({
    ...dados,
    status: 'Agendada',
    closer_confirmou: false,
  })
  if (error) throw error
}

const TIPOS_REUNIAO = ['Reunião de apresentação', 'Demo', 'Proposta comercial', 'Follow-up', 'Outro']

const STATUS_COR: Record<string, string> = {
  Agendada: '#1A56DB',
  Confirmada: '#16A34A',
  Realizada: '#64748B',
  Cancelada: '#DC2626',
  'No-show': '#D97706',
}

export default function AgendaScreen() {
  const { userName } = useAuth()
  const [aba, setAba] = useState<'hoje' | 'semana'>('hoje')
  const [refreshing, setRefreshing] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const qc = useQueryClient()

  // Estado do formulário
  const [form, setForm] = useState<{
    client_name: string; tipo: string; data_inicio: string
    duracao: string; closer_nome: string; sdr_nome: string
    local: string; link_reuniao: string; observacoes: string
  }>({
    client_name: '',
    tipo: TIPOS_REUNIAO[0],
    data_inicio: '',
    duracao: '60',
    closer_nome: CLOSER_NAMES[0],
    sdr_nome: userName,
    local: '',
    link_reuniao: '',
    observacoes: '',
  })
  const [salvando, setSalvando] = useState(false)

  function parseDataBR(dataBR: string): string | null {
    // Aceita "DD/MM/YYYY HH:MM" → ISO
    const match = dataBR.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
    if (!match) return null
    const [, d, m, y, h, min] = match
    return `${y}-${m}-${d}T${h}:${min}:00`
  }

  async function handleSalvar() {
    if (!form.client_name.trim()) {
      Alert.alert('Atenção', 'Informe o nome do cliente.')
      return
    }
    const inicio = parseDataBR(form.data_inicio)
    if (!inicio) {
      Alert.alert('Atenção', 'Data inválida. Use o formato DD/MM/AAAA HH:MM')
      return
    }
    const fimMs = new Date(inicio).getTime() + Number(form.duracao) * 60000
    const fim = new Date(fimMs).toISOString()

    setSalvando(true)
    try {
      await criarReuniao({
        client_name: form.client_name.trim(),
        tipo: form.tipo,
        data_inicio: inicio,
        data_fim: fim,
        closer_nome: form.closer_nome,
        sdr_nome: form.sdr_nome || userName,
        local: form.local || undefined,
        link_reuniao: form.link_reuniao || undefined,
        observacoes: form.observacoes || undefined,
      })
      qc.invalidateQueries({ queryKey: ['agenda'] })
      setModalAberto(false)
      setForm({
        client_name: '', tipo: TIPOS_REUNIAO[0],
        data_inicio: '', duracao: '60',
        closer_nome: CLOSER_NAMES[0], sdr_nome: userName,
        local: '', link_reuniao: '', observacoes: '',
      })
      Alert.alert('✅ Reunião agendada!')
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    } finally {
      setSalvando(false)
    }
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['agenda', aba],
    queryFn: () => fetchAgenda(aba),
    refetchInterval: 60_000,
  })

  async function onRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  async function handleConfirmar(item: CrmAgenda) {
    Alert.alert('Confirmar presença?', `${item.client_name}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          await confirmarPresenca(item.id)
          qc.invalidateQueries({ queryKey: ['agenda'] })
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
      {/* Modal novo agendamento */}
      <Modal visible={modalAberto} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={s.modal} contentContainerStyle={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Nova Reunião</Text>
              <TouchableOpacity onPress={() => setModalAberto(false)}>
                <Text style={s.modalFechar}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Cliente *</Text>
            <TextInput
              style={s.input}
              value={form.client_name}
              onChangeText={v => setForm(f => ({ ...f, client_name: v }))}
              placeholder="Nome da empresa"
              placeholderTextColor="#94A3B8"
            />

            <Text style={s.label}>Tipo de reunião</Text>
            <View style={s.opcoesRow}>
              {TIPOS_REUNIAO.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.opcaoBtn, form.tipo === t && s.opcaoBtnAtivo]}
                  onPress={() => setForm(f => ({ ...f, tipo: t }))}
                >
                  <Text style={[s.opcaoBtnText, form.tipo === t && s.opcaoBtnTextoAtivo]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Data e hora * (DD/MM/AAAA HH:MM)</Text>
            <TextInput
              style={s.input}
              value={form.data_inicio}
              onChangeText={v => setForm(f => ({ ...f, data_inicio: v }))}
              placeholder="Ex: 15/06/2025 14:00"
              placeholderTextColor="#94A3B8"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={s.label}>Duração (minutos)</Text>
            <View style={s.opcoesRow}>
              {['30', '60', '90', '120'].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.opcaoBtn, form.duracao === d && s.opcaoBtnAtivo]}
                  onPress={() => setForm(f => ({ ...f, duracao: d }))}
                >
                  <Text style={[s.opcaoBtnText, form.duracao === d && s.opcaoBtnTextoAtivo]}>
                    {d}min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Closer</Text>
            <View style={s.opcoesRow}>
              {CLOSER_NAMES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.opcaoBtn, form.closer_nome === c && s.opcaoBtnAtivo]}
                  onPress={() => setForm(f => ({ ...f, closer_nome: c as string }))}
                >
                  <Text style={[s.opcaoBtnText, form.closer_nome === c && s.opcaoBtnTextoAtivo]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Local (opcional)</Text>
            <TextInput
              style={s.input}
              value={form.local}
              onChangeText={v => setForm(f => ({ ...f, local: v }))}
              placeholder="Endereço ou plataforma"
              placeholderTextColor="#94A3B8"
            />

            <Text style={s.label}>Link da reunião (opcional)</Text>
            <TextInput
              style={s.input}
              value={form.link_reuniao}
              onChangeText={v => setForm(f => ({ ...f, link_reuniao: v }))}
              placeholder="https://meet.google.com/..."
              placeholderTextColor="#94A3B8"
              keyboardType="url"
              autoCapitalize="none"
            />

            <Text style={s.label}>Observações (opcional)</Text>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: 'top' }]}
              value={form.observacoes}
              onChangeText={v => setForm(f => ({ ...f, observacoes: v }))}
              placeholder="Informações adicionais..."
              placeholderTextColor="#94A3B8"
              multiline
            />

            <TouchableOpacity
              style={[s.btnSalvar, salvando && { opacity: 0.6 }]}
              onPress={handleSalvar}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnSalvarText}>✅ Agendar reunião</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>📅 Agenda</Text>
          <TouchableOpacity style={s.btnNovo} onPress={() => setModalAberto(true)}>
            <Text style={s.btnNovoText}>+ Nova</Text>
          </TouchableOpacity>
        </View>
        <View style={s.tabs}>
          {(['hoje', 'semana'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, aba === t && s.tabActive]}
              onPress={() => setAba(t)}
            >
              <Text style={[s.tabText, aba === t && s.tabTextActive]}>
                {t === 'hoje' ? 'Hoje' : 'Esta semana'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={i => i.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F2D5E" />
        }
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text style={s.empty}>Nenhuma reunião {aba === 'hoje' ? 'hoje' : 'esta semana'}.</Text>
        }
        renderItem={({ item }) => {
          const cor = STATUS_COR[item.status] ?? '#64748B'
          return (
            <View style={[s.card, { borderLeftColor: cor }]}>
              <View style={s.cardTop}>
                <View style={s.horarioWrap}>
                  <Text style={s.horario}>{formatTime(item.data_inicio)}</Text>
                  {aba === 'semana' && (
                    <Text style={s.data}>{formatDate(item.data_inicio)}</Text>
                  )}
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.clientName} numberOfLines={1}>
                    {item.client_name}
                  </Text>
                  <Text style={s.cardSub}>
                    {item.tipo} · {item.closer_nome}
                  </Text>
                  {item.sdr_nome && (
                    <Text style={s.cardSub}>SDR: {item.sdr_nome}</Text>
                  )}
                </View>
                <View style={[s.statusBadge, { backgroundColor: cor + '22' }]}>
                  <Text style={[s.statusText, { color: cor }]}>{item.status}</Text>
                </View>
              </View>

              {item.local && (
                <Text style={s.local}>📍 {item.local}</Text>
              )}

              <View style={s.acoes}>
                {item.link_reuniao && (
                  <TouchableOpacity
                    style={s.btnLink}
                    onPress={() => Linking.openURL(item.link_reuniao!)}
                  >
                    <Text style={s.btnLinkText}>🔗 Abrir link</Text>
                  </TouchableOpacity>
                )}
                {!item.closer_confirmou && item.status === 'Agendada' && (
                  <TouchableOpacity
                    style={s.btnConfirmar}
                    onPress={() => handleConfirmar(item)}
                  >
                    <Text style={s.btnConfirmarText}>✅ Confirmar presença</Text>
                  </TouchableOpacity>
                )}
                {item.closer_confirmou && (
                  <Text style={s.confirmado}>✅ Presença confirmada</Text>
                )}
              </View>
            </View>
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
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  btnNovo: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  btnNovoText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modal: { flex: 1, backgroundColor: '#F8FAFC' },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  modalFechar: { fontSize: 20, color: '#64748B', padding: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0F172A' },
  opcoesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcaoBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  opcaoBtnAtivo: { backgroundColor: '#0F2D5E', borderColor: '#0F2D5E' },
  opcaoBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  opcaoBtnTextoAtivo: { color: '#fff' },
  btnSalvar: { backgroundColor: '#0F2D5E', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  btnSalvarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: '#0F2D5E' },
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
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  horarioWrap: { alignItems: 'center', minWidth: 44 },
  horario: { fontSize: 15, fontWeight: '700', color: '#0F2D5E' },
  data: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  cardInfo: { flex: 1, minWidth: 0 },
  clientName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
  local: { fontSize: 12, color: '#475569', marginTop: 8 },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  btnLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  btnLinkText: { fontSize: 12, fontWeight: '600', color: '#1A56DB' },
  btnConfirmar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  btnConfirmarText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
  confirmado: { fontSize: 12, color: '#16A34A', fontWeight: '600', paddingVertical: 6 },
})
