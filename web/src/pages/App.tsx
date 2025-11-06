import { Link, Route, Routes, NavLink } from 'react-router-dom'
import Upload from './Upload'
import Jobs from './Jobs'
import JobDetail from './JobDetail'
import Catalog from './Catalog'

export default function App() {
  return (
    <div className="min-h-screen text-slate-900">
      <header className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">StreamLab</h1>
          <nav className="flex gap-4">
            <NavLink to="/upload" className={({isActive}) => isActive ? 'font-semibold' : ''}>Upload</NavLink>
            <NavLink to="/jobs" className={({isActive}) => isActive ? 'font-semibold' : ''}>Jobs</NavLink>
            <NavLink to="/catalog" className={({isActive}) => isActive ? 'font-semibold' : ''}>Catalog</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/catalog" element={<Catalog />} />
        </Routes>
      </main>
    </div>
  )
}
