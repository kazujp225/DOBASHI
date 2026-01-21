import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Search, Download, Users, Moon, Sun, FileText, Menu } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'ダッシュボード' },
  { path: '/analysis', icon: Search, label: '動画分析' },
  { path: '/collection', icon: Download, label: 'データ収集' },
  { path: '/tigers', icon: Users, label: '社長マスタ' },
  { path: '/reports', icon: FileText, label: 'レポート' },
]

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const NavLink = ({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) => {
    const Icon = item.icon
    const isActive = location.pathname === item.path

    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 md:px-6">
          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">メニューを開く</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-14 items-center border-b px-4">
                <span className="text-xl">🐯</span>
                <span className="ml-2 font-semibold">令和の虎</span>
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {navItems.map((item) => (
                  <NavLink key={item.path} item={item} onClick={() => setIsOpen(false)} />
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-xl">🐯</span>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold">令和の虎 コメント分析</h1>
              <p className="text-xs text-muted-foreground">v2.2</p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="テーマを切り替え"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-56 flex-col border-r bg-background min-h-[calc(100vh-3.5rem)]">
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t py-4">
        <p className="text-center text-sm text-muted-foreground">
          © 2025 令和の虎分析システム | v2.2
        </p>
      </footer>
    </div>
  )
}

export default Layout
