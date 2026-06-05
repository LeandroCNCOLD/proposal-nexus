import { createFileRoute } from '@tanstack/react-router'
import { WarRoomPanel } from '@/modules/crm/components/WarRoomPanel'

export const Route = createFileRoute('/app/war-room')({
  component: () => <div className="p-6"><WarRoomPanel /></div>,
})
