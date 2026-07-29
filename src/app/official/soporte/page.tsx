import { SoportePage } from '@/components/official/soporte/SoportePage'

export const metadata = {
  title: 'Soporte | GONOVI',
  description: 'Contanos tu duda y te respondemos por email.',
}

export const dynamic = 'force-dynamic'

export default function Page() {
  return <SoportePage />
}
