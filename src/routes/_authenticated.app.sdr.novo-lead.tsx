import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/app/sdr/novo-lead')({
  beforeLoad: () => {
    throw redirect({ to: '/app/marketing/novo' })
  },
  component: () => null,
})
