
interface AuthContainerProps {
  children: React.ReactNode
}

export const AuthContainer = ({ children }: AuthContainerProps) => {
  return (
    <div className="w-full max-w-sm">
      <div className="relative">
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent blur-3xl -z-10 rounded-3xl" />
        
        {children}
      </div>
    </div>
  )
}
