import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AuthCardWrapperProps {
  title: string
  description: string
  children: React.ReactNode
}

export const AuthCardWrapper = ({
  title,
  description,
  children
}: AuthCardWrapperProps) => {
  return (
    <Card className="backdrop-blur-sm bg-background/95 border-none group/card relative overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1 shadow-none  hover:shadow-primary/20 cursor-pointer">
      {/* Shimmer effect - Add pointer-events-none */}
      {/* <div className="absolute inset-0 -translate-x-full group-hover/card:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-primary/10 to-transparent pointer-events-none" /> */}

      {/* Glow effect - Add pointer-events-none */}
      {/* <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg blur-lg opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" /> */}
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {title}
        </CardTitle>
        <CardDescription className="text-sm">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}
