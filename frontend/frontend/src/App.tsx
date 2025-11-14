import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Analysis from './pages/Analysis'
import Collection from './pages/Collection'
import Tigers from './pages/Tigers'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/tigers" element={<Tigers />} />
      </Routes>
    </Layout>
  )
}

export default App
