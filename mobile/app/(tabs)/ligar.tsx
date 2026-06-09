import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMinhaCarteira } from '../../src/services/pipeline'
import { useTelefonia } from '../../src/contexts/TelefoniaContext'
import { useAuth } from '../../src/contexts/AuthContext'
import { formatCurrency, formatarDuracao } from '../../src/lib/utils'
import type { CallResult, Temperature, CrmPipeline } from '../../src/types/crm'
import {
  CALL_RESULTS_ATENDEU,
  CALL_RESULTS_NAO_ATENDEU,
  TEMPERATURE_OPTIONS,
  CLOSER_NAMES,
} from '../../src/types/crm'

const EMOJI_RESULTADO: Record<string, string> = {
  'Atendeu - Muito interessado': '✅',
  'Atendeu - Pediu retorno': '🔄',
  'Atendeu - Resistência de preço': '💰',
  'Atendeu - Projeto parado/cancelado': '⛔',
  'Não atendeu - WhatsApp': '📱',
  'Não atendeu - Caixa postal': '📞',
  'Número inválido': '🚫',
  'Concorrente ganhou': '🏆',
  Outros: '📝',
}

export default function LigarScreen() {
  const { userId, userName } = useAuth()
  const { ligar, finalizar, ligacaoAtiva, segundos } = useTelefonia()
  const qc = useQueryClient()

  const [reuniaoAgendada, setReuniaoAgendada] = useState(false)
  const [tempSelecionada, setTempSelecionada] = useState<Temperature | null>(null)
  const [finalizando, setFinalizando] = useState(false)

  const { data: carteira, isLoading } = useQuery({
    queryKey: ['minha-carteira', userId],
    queryFn: () => fetchMinhaCarteira(userId),
    enabled: !!userId,
    refetchInterval: 120_000,
  })

  // Próximo lead = maior valor sem contato hoje
  const hoje = new Date().toISOString().slice(0, 10)
  const proximoLead = carteira?.find(
    l =>
      !l.last_contact_at ||
      l.last_contact_at < hoje
  ) ?? carteira?.[0] ?? null

  async function handleLigar(lead: CrmPipeline, tipo: 'celular' | 'fixo' | 'whatsapp') {
    const numero =
      tipo === 'celular' || tipo === 'whatsapp'
        ? lead.contact_mobile
        : lead.contact_phone
    if (!numero) {
      Alert.alert('Sem número', 'Esse contato não tem número cadastrado.')
      return
    }
    await ligar({
      pipelineId: lead.id,
      sdrId: userId,
      sdrName: userName,
      numero,
      tipo,
      clientName: lead.client_name,
    })
  }

  async function handleResultado(result: CallResult) {
    setFinalizando(true)
    try {
      await finalizar({
        result,
        meeting_booked: reuniaoAgendada,
        temperature_after: tempSelecionada ?? undefined,
      })
      setReuniaoAgendada(false)
      setTempSelecionada(null)
      qc.invalidateQueries({ queryKey: ['minha-carteira'] })
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    } finally {
      setFinalizando(false)
    }
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0F2D5E" />
      </View>
    )
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.headerTitle}>📞 Discagem Rápida</Text>
      </View>

      {/* Ligação ativa — cronômetro */}
      {ligacaoAtiva && (
        <View style={s.ligacaoAtiva}>
          <Text style={s.ligacaoNome}>{ligacaoAtiva.clientName}</Text>
          <Text style={s.ligacaoNumero}>{ligacaoAtiva.numero}</Text>
          <Text style={s.cronometro}>{formatarDuracao(segundos)}</Text>

          {/* Temperatura após */}
          <Text style={s.subLabel}>Temperatura após contato:</Text>
          <View style={s.tempRow}>
            {TEMPERATURE_OPTIONS.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tempBtn, tempSelecionada === t && s.tempBtnActive]}
                onPress={() => setTempSelecionada(t)}
              >
                <Text style={[s.tempBtnText, tempSelecionada === t && s.tempBtnTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reunião agendada */}
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Reunião agendada?</Text>
            <Switch
              value={reuniaoAgendada}
              onValueChange={setReuniaoAgendada}
              trackColor={{ false: '#CBD5E1', true: '#0F2D5E' }}
            />
          </View>

          {/* Grid de resultado */}
          <Text style={s.subLabel}>Resultado da ligação:</Text>

          <Text style={s.grupoLabel}>Atendeu</Text>
          <View style={s.grid}>
            {CALL_RESULTS_ATENDEU.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.resultBtn, s.resultBtnAtendeu]}
                onPress={() => handleResultado(r)}
                disabled={finalizando}
              >
                <Text style={s.resultEmoji}>{EMOJI_RESULTADO[r]}</Text>
                <Text style={s.resultLabel} numberOfLines={2}>
                  {r.replace('Atendeu - ', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.grupoLabel}>Não atendeu</Text>
          <View style={s.grid}>
            {CALL_RESULTS_NAO_ATENDEU.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.resultBtn, s.resultBtnNaoAtendeu]}
                onPress={() => handleResultado(r)}
                disabled={finalizando}
              >
                <Text style={s.resultEmoji}>{EMOJI_RESULTADO[r]}</Text>
                <Text style={s.resultLabel} numberOfLines={2}>
                  {r.replace('Não atendeu - ', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Próximo lead */}
      {!ligacaoAtiva && proximoLead && (
        <View style={s.leadCard}>
          <Text style={s.leadNome} numberOfLines={2}>
            {proximoLead.client_name}
          </Text>
          <Text style={s.leadMeta}>
            {proximoLead.proposal_number} · {proximoLead.state ?? ''}
          </Text>
          <Text style={s.leadValor}>{formatCurrency(proximoLead.value)}</Text>
          {(proximoLead.days_without_contact ?? 0) > 10 && (
            <Text style={s.leadAlerta}>
              ⚠️ {proximoLead.days_without_contact}d sem contato
            </Text>
          )}

          <View style={s.botoesLigar}>
            <TouchableOpacity
              style={[s.btnLigar, s.btnCelular]}
              onPress={() => handleLigar(proximoLead, 'celular')}
            >
              <Text style={s.btnLigarText}>📞 CELULAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnLigar, s.btnWhatsApp]}
              onPress={() => handleLigar(proximoLead, 'whatsapp')}
            >
              <Text style={s.btnLigarText}>💬 WHATSAPP</Text>
            </TouchableOpacity>
          </View>
          {proximoLead.contact_phone && (
            <TouchableOpacity
              style={[s.btnLigar, s.btnFixo]}
              onPress={() => handleLigar(proximoLead, 'fixo')}
            >
              <Text style={[s.btnLigarText, { color: '#0F2D5E' }]}>☎️ FIXO</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!ligacaoAtiva && !proximoLead && (
        <View style={s.center}>
          <Text style={s.emptyText}>
            🎉 Nenhum lead pendente na sua carteira!
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { backgroundColor: '#0F2D5E', padding: 20, paddingTop: 56 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },

  leadCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  leadNome: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  leadMeta: { fontSize: 13, color: '#64748B', marginBottom: 8 },
  leadValor: { fontSize: 24, fontWeight: '700', color: '#1A56DB', marginBottom: 4 },
  leadAlerta: { fontSize: 13, color: '#DC2626', fontWeight: '600', marginBottom: 12 },
  botoesLigar: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnLigar: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCelular: { backgroundColor: '#0F2D5E' },
  btnWhatsApp: { backgroundColor: '#16A34A' },
  btnFixo: {
    marginTop: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnLigarText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

  ligacaoAtiva: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  ligacaoNome: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  ligacaoNumero: { fontSize: 14, color: '#64748B', marginTop: 2, marginBottom: 8 },
  cronometro: {
    fontSize: 40,
    fontWeight: '700',
    color: '#0F2D5E',
    textAlign: 'center',
    marginVertical: 12,
    fontVariant: ['tabular-nums'],
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  tempRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tempBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tempBtnActive: { backgroundColor: '#0F2D5E', borderColor: '#0F2D5E' },
  tempBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tempBtnTextActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#F1F5F9',
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  grupoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultBtn: {
    width: '47%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  resultBtnAtendeu: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  resultBtnNaoAtendeu: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultEmoji: { fontSize: 22 },
  resultLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  emptyText: { fontSize: 15, color: '#64748B', textAlign: 'center' },
})
