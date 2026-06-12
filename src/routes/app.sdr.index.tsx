import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/sdr/')({
  beforeLoad: () => {
    throw redirect({ to: '/app/sdr/bank' })
  },
})
