import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Search, Download, Users, Moon, Sun } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'ダッシュボード' },
    { path: '/analysis', icon: Search, label: '動画分析' },
    { path: '/collection', icon: Download, label: 'データ収集' },
    { path: '/tigers', icon: Users, label: '社長マスタ' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-all duration-200">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-40 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/30">
                <span className="text-2xl">🐯</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  令和の虎 コメント分析
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">v2.2 Professional</p>
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-500 shadow-md hover:shadow-lg transition-all duration-200"
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
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar */}
        <nav className="w-64 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-lg min-h-[calc(100vh-80px)] border-r border-gray-200/50 dark:border-gray-700/50 transition-all duration-200">
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
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-8 transition-colors duration-200">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-t-2 border-gray-200/50 dark:border-gray-700/50 mt-12 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 font-medium">
            © 2025 令和の虎分析システム | Version 2.2
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
