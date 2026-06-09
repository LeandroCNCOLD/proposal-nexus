import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Configurar como as notificações aparecem quando o app está aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registrarPushToken(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push só funciona em dispositivo físico')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Permissão de notificação negada')
    return null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CN Cold',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F2D5E',
    })
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data
    // Salvar token no perfil do usuário no Supabase
    await supabase
      .from('crm_team_members')
      .update({ push_token: token } as any)
      .eq('user_id', userId)
    return token
  } catch (e) {
    console.warn('Erro ao registrar push token:', e)
    return null
  }
}

// Notificação local — agendada
export async function agendarLembrete(opts: {
  titulo: string
  corpo: string
  segundosAte: number
  dados?: Record<string, unknown>
}): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.titulo,
      body: opts.corpo,
      data: opts.dados ?? {},
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: opts.segundosAte },
  })
  return id
}

// Notificação imediata local
export async function notificarAgora(titulo: string, corpo: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: titulo, body: corpo, sound: true },
    trigger: null,
  })
}

// Cancelar todos os lembretes agendados
export async function cancelarLembretes(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

// Agendar lembretes diários de follow-up (08:00)
export async function agendarFollowUpDiario(): Promise<void> {
  await cancelarLembretes()
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📞 Hora de ligar!',
      body: 'Você tem leads aguardando contato hoje. Bora bater a meta!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  })
}
