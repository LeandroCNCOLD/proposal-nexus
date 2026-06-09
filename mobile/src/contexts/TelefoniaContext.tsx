import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import { Linking } from 'react-native'
import { iniciarLigacao, finalizarLigacao } from '../services/call-logs'
import type { CallResult, Temperature } from '../types/crm'

interface LigacaoAtiva {
  logId: string
  pipelineId: string
  clientName: string
  numero: string
  iniciadoEm: Date
}

interface TelefoniaContextType {
  ligacaoAtiva: LigacaoAtiva | null
  segundos: number
  ligar: (params: {
    pipelineId: string
    sdrId: string
    sdrName: string
    numero: string
    tipo: 'celular' | 'fixo' | 'whatsapp'
    clientName: string
  }) => Promise<void>
  finalizar: (resultado: {
    result: CallResult
    meeting_booked: boolean
    observation?: string
    temperature_after?: Temperature
  }) => Promise<void>
  cancelar: () => void
}

const TelefoniaContext = createContext<TelefoniaContextType>({} as TelefoniaContextType)

export function TelefoniaProvider({ children }: { children: ReactNode }) {
  const [ligacaoAtiva, setLigacaoAtiva] = useState<LigacaoAtiva | null>(null)
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    if (!ligacaoAtiva) {
      setSegundos(0)
      return
    }
    const t = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [ligacaoAtiva])

  const ligar = useCallback(
    async (params: {
      pipelineId: string
      sdrId: string
      sdrName: string
      numero: string
      tipo: 'celular' | 'fixo' | 'whatsapp'
      clientName: string
    }) => {
      const log = await iniciarLigacao({
        pipeline_id: params.pipelineId,
        sdr_id: params.sdrId,
        sdr_name: params.sdrName,
        numero_discado: params.numero,
        tipo_numero: params.tipo,
      })
      setLigacaoAtiva({
        logId: log.id,
        pipelineId: params.pipelineId,
        clientName: params.clientName,
        numero: params.numero,
        iniciadoEm: new Date(),
      })
      const limpo = params.numero.replace(/[^\d+]/g, '')
      if (params.tipo === 'whatsapp') {
        Linking.openURL(`whatsapp://send?phone=55${limpo}`)
      } else {
        Linking.openURL(`tel:${limpo}`)
      }
    },
    []
  )

  const finalizar = useCallback(
    async (resultado: {
      result: CallResult
      meeting_booked: boolean
      observation?: string
      temperature_after?: Temperature
    }) => {
      if (!ligacaoAtiva) return
      await finalizarLigacao(ligacaoAtiva.logId, ligacaoAtiva.pipelineId, {
        ...resultado,
        duracao_segundos: segundos,
      })
      setLigacaoAtiva(null)
      setSegundos(0)
    },
    [ligacaoAtiva, segundos]
  )

  const cancelar = useCallback(() => {
    setLigacaoAtiva(null)
    setSegundos(0)
  }, [])

  return (
    <TelefoniaContext.Provider value={{ ligacaoAtiva, segundos, ligar, finalizar, cancelar }}>
      {children}
    </TelefoniaContext.Provider>
  )
}

export const useTelefonia = () => useContext(TelefoniaContext)
