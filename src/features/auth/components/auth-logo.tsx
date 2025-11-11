
import Image from 'next/image'
import Link from 'next/link'

export const AuthLogo = () => {
  return (
    <Link 
      href='/' 
      className='flex items-center gap-2 self-center font-semibold text-lg hover:opacity-80 transition-opacity'
    >
      <div className="relative">
        <Image 
          src='/logos/logo.svg' 
          alt='Logo' 
          width={32} 
          height={32}
          className="drop-shadow-sm"
        />
      </div>
      <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
        n8n
      </span>
    </Link>
  )
}
