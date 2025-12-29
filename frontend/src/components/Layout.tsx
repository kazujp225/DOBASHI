import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Search, Download, Users, Moon, Sun, BarChart3, FileText, Calendar, Menu, X, ChevronDown } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'ダッシュボード' },
    { path: '/monthly', icon: Calendar, label: '月別ランキング' },
    { path: '/analysis', icon: Search, label: '動画分析' },
    { path: '/collection', icon: Download, label: 'データ収集' },
    { path: '/tigers', icon: Users, label: '社長マスタ' },
    { path: '/comparison', icon: BarChart3, label: '比較分析' },
    { path: '/reports', icon: FileText, label: 'レポート' },
  ]

  const handleNavClick = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-all duration-200">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-50 transition-all duration-200">
        <div className="w-full px-4 md:px-6">
          <div className="flex justify-between items-center py-3 md:py-4">
            <div className="flex items-center gap-3 md:gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X size={24} className="text-gray-700 dark:text-gray-300" />
                ) : (
                  <Menu size={24} className="text-gray-700 dark:text-gray-300" />
                )}
              </button>

              <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/30">
                <span className="text-xl md:text-2xl">🐯</span>
              </div>
              <div>
                <h1 className="text-base md:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  <span className="hidden sm:inline">令和の虎 コメント分析</span>
                  <span className="sm:hidden">令和の虎</span>
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">v2.2 Professional</p>
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 md:p-2.5 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-500 shadow-md hover:shadow-lg transition-all duration-200"
              aria-label="Toggle dark mode"
            >
              {theme === 'light' ? (
                <Moon size={20} className="text-gray-700" />
              ) : (
                <Sun size={20} className="text-yellow-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Accordion Menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="px-4 pb-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <div className="pt-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleNavClick}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 font-semibold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/70'
                    }`}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>
        </div>
      </header>

      <div className="flex w-full">
        {/* Sidebar - Desktop */}
        <nav className="hidden md:block w-56 flex-shrink-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-lg min-h-[calc(100vh-80px)] border-r border-gray-200/50 dark:border-gray-700/50 transition-all duration-200">
          <div className="p-4">
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 font-semibold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/70 hover:shadow-md'
                    }`}
                  >
                    <Icon size={20} aria-hidden="true" className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-3 md:p-4 transition-colors duration-200">
          <div className="w-full max-w-none">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-t-2 border-gray-200/50 dark:border-gray-700/50 mt-8 md:mt-12 transition-all duration-200">
        <div className="w-full px-4 md:px-6 py-4 md:py-6">
          <p className="text-center text-xs md:text-sm text-gray-600 dark:text-gray-400 font-medium">
            © 2025 令和の虎分析システム | Version 2.2
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
