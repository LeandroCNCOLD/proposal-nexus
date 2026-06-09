export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function diasSemContato(lastContact: string | null): number {
  if (!lastContact) return 999
  return Math.floor(
    (Date.now() - new Date(lastContact).getTime()) / 86_400_000
  )
}

export function formatarDuracao(segundos: number): string {
  const m = Math.floor(segundos / 60).toString().padStart(2, '0')
  const s = (segundos % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function corTemperatura(temp: string): string {
  const map: Record<string, string> = {
    Frio: '#3B82F6',
    Morno: '#F59E0B',
    Quente: '#F97316',
    'Muito Quente': '#EF4444',
  }
  return map[temp] ?? '#94A3B8'
}

export function corPrioridade(prio: string): string {
  const map: Record<string, string> = {
    Alta: '#EF4444',
    Média: '#F59E0B',
    Baixa: '#22C55E',
  }
  return map[prio] ?? '#94A3B8'
}
