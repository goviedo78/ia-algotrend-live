import { SoportePage } from '@/components/official/soporte/SoportePage'

export const metadata = {
  title: 'Soporte | GONOVI',
  description: 'Contanos tu duda y te respondemos por email.',
  alternates: { canonical: 'https://gonovi.app/official/soporte' },
}

export const dynamic = 'force-dynamic'

export default function Page() {
  return <SoportePage />
}
