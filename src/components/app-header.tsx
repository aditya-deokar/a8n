
import { SidebarTrigger } from './ui/sidebar'
import { ModeToggle } from './mode-toggle'

const AppHeader = () => {
  return (
    <header className='flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 '>
        <SidebarTrigger/>
        <ModeToggle/>
    </header>
  )
}

export default AppHeader