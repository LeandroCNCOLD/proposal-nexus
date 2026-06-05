import { createFileRoute } from '@tanstack/react-router'
import { WarRoomPanel } from '@/modules/sdr/components/WarRoomPanel'

export const Route = createFileRoute('/app/sdr/war-room')({
  component: () => <div className="p-6"><WarRoomPanel /></div>,
})
