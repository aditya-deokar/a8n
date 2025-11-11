import { AuthContainer } from '@/features/auth/components/auth-container'
import { AuthLogo } from '@/features/auth/components/auth-logo'
import React from 'react'

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='flex min-h-screen'>
      {/* Left Side - Branding/Visual Section */}
      <div className='hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-primary via-primary/90 to-primary/80 relative overflow-hidden'>
        {/* Animated Background Pattern */}
        <div className='absolute inset-0 opacity-10'>
          <div className='absolute inset-0' style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '48px 48px'
          }} />
        </div>
        
        {/* Content */}
        <div className='relative z-10 flex flex-col justify-between p-12 xl:p-16 text-primary-foreground w-full'>
          {/* Logo */}
          <div className='flex items-center gap-2'>
            <div className='h-10 w-10 rounded-lg bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center font-bold text-xl'>
              A
            </div>
            <span className='text-2xl font-bold'>AutoFlow</span>
          </div>

          {/* Center Content */}
          <div className='space-y-6 max-w-lg'>
            <h1 className='text-5xl xl:text-6xl font-bold leading-tight'>
              Automate your workflow with ease
            </h1>
            <p className='text-lg text-primary-foreground/80'>
              Connect your favorite tools and services. Build powerful automation workflows without writing a single line of code.
            </p>
            
            {/* Feature List */}
            <div className='space-y-4 pt-8'>
              {[
                { title: 'Visual Workflow Builder', desc: 'Drag and drop to create automations' },
                { title: 'Seamless Integrations', desc: '100+ apps and services connected' },
                { title: 'Real-time Execution', desc: 'Watch your workflows run instantly' }
              ].map((feature, idx) => (
                <div key={idx} className='flex items-start gap-3'>
                  <div className='h-6 w-6 rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 mt-0.5'>
                    <svg className='h-3.5 w-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                    </svg>
                  </div>
                  <div>
                    <h3 className='font-semibold'>{feature.title}</h3>
                    <p className='text-sm text-primary-foreground/70'>{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className='flex items-center gap-6 text-sm text-primary-foreground/60'>
            <span>© 2025 AutoFlow</span>
            <span>•</span>
            <a href='#' className='hover:text-primary-foreground transition-colors'>Privacy</a>
            <span>•</span>
            <a href='#' className='hover:text-primary-foreground transition-colors'>Terms</a>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className='absolute top-20 right-20 h-64 w-64 rounded-full bg-primary-foreground/10 blur-3xl' />
        <div className='absolute bottom-20 left-20 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl' />
      </div>

      {/* Right Side - Form Section */}
      <div className='flex-1 flex flex-col justify-center items-center p-6 md:p-10 bg-background'>
        <div className='w-full max-w-md space-y-8'>
          {/* Mobile Logo */}
          <div className='lg:hidden'>
            <AuthLogo />
          </div>

          {/* Form Container */}
          <AuthContainer>
            {children}
          </AuthContainer>

          {/* Mobile Footer */}
          <p className='lg:hidden text-center text-xs text-muted-foreground'>
            Automate your workflow with ease
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
