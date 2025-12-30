import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Analysis from './pages/Analysis'
import Collection from './pages/Collection'
import Tigers from './pages/Tigers'
import Reports from './pages/Reports'

function AppContent() {
  const { theme } = useTheme()

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: theme === 'dark' ? '#1f2937' : '#fff',
            color: theme === 'dark' ? '#f3f4f6' : '#374151',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: theme === 'dark' ? '#1f2937' : '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: theme === 'dark' ? '#1f2937' : '#fff',
            },
          },
        }}
      />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/tigers" element={<Tigers />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
