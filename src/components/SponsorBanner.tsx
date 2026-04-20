import Image from 'next/image'

export default function SponsorBanner() {
  // Acá podés configurar los datos del broker que te pague el espacio
  const sponsor = {
    name: 'Broker Partner',
    tagline: 'Opera estas señales con 0% de comisión',
    url: '#', // El link de afiliado o link que te pase el broker
    // image: '/banners/broker-banner.png', // Descomentar si te pasan una imagen
    logo: '🏦', // O un logo real del broker importado
    cta: 'Crear cuenta'
  }

  return (
    <a 
      href={sponsor.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block surface-panel overflow-hidden group cursor-pointer border border-[#1F2937] hover:border-[#3B82F6]/50 transition-all duration-300 relative"
    >
      {/* Etiqueta de "Sponsor Oficial" sutil en la parte superior */}
      <div className="absolute top-0 right-0 bg-[#3B82F6]/10 px-2 py-1 rounded-bl-lg border-b border-l border-[#3B82F6]/20">
        <p className="text-[8px] uppercase tracking-wider text-[#3B82F6] font-semibold">Partner Oficial</p>
      </div>

      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Usar esto si el broker te pasa un BANNER IMAGEN rectangular */}
        {/* 
        <div className="w-full h-24 relative rounded-lg overflow-hidden bg-black/20">
          <Image src={sponsor.image} alt="Sponsor" fill className="object-cover" />
        </div> 
        */}

        {/* Usar esto si quieres integrarlo de manera nativa (Logo + Texto) */}
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#334155] flex items-center justify-center text-xl shadow-lg">
            {sponsor.logo}
          </div>
          <div>
            <h4 className="font-semibold text-[#E5E7EB] group-hover:text-[#3B82F6] transition-colors">
              {sponsor.name}
            </h4>
            <p className="text-[#9CA3AF] text-xs">
              {sponsor.tagline}
            </p>
          </div>
        </div>

        <div className="mt-1 w-full bg-[#1F2937]/50 hover:bg-[#3B82F6]/20 border border-[#374151] hover:border-[#3B82F6]/40 text-[#D1D5DB] hover:text-[#60A5FA] text-xs font-semibold py-2 rounded-lg text-center transition-all">
          {sponsor.cta} →
        </div>
      </div>
    </a>
  )
}
