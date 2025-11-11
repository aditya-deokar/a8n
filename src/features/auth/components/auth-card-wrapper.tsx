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
    <Card className="backdrop-blur-sm bg-background/95 border-border/50 shadow-xl ">
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
