import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Cockpit from './pages/Cockpit'
import ContentCalendar from './pages/ContentCalendar'
import IPAssets from './pages/IPAssets'
import Characters from './pages/Characters'
import Assistant from './pages/Assistant'
import Outsourcing from './pages/Outsourcing'
import Community from './pages/Community'
import Dashboard from './pages/Dashboard'
import Settings from './components/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Cockpit />} />
        <Route path="assets" element={<IPAssets />} />
        <Route path="characters" element={<Characters />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="content" element={<ContentCalendar />} />
        <Route path="outsourcing" element={<Outsourcing />} />
        <Route path="community" element={<Community />} />
        <Route path="data" element={<Dashboard />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
