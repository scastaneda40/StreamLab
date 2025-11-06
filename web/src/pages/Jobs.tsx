import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Link } from 'react-router-dom'

type Stage = { name: string; status: string; startedAt: number|null; endedAt: number|null }
type Job = {
  id: string; title: string; status: string; createdAt: number; updatedAt: number;
  stages: Stage[]
}

function StagePill({s}:{s:Stage}) {
  const color = s.status === 'complete' ? 'bg-green-100 text-green-800'
    : s.status === 'processing' ? 'bg-yellow-100 text-yellow-800'
    : s.status === 'failed' ? 'bg-red-100 text-red-800'
    : 'bg-slate-100 text-slate-800'
  return <span className={`px-2 py-1 rounded text-xs ${color}`}>{s.name}: {s.status}</span>
}

export default function Jobs() {
  const q = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => (await api.get('/jobs')).data,
    refetchInterval: 1500
  })

  const jobs: Job[] = q.data ?? []

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Jobs</h2>
      <div className="space-y-3">
        {jobs.map(j => (
          <div key={j.id} className="bg-white border rounded p-4">
            <div className="flex items-center justify-between">
              <div>
                <Link to={`/jobs/${j.id}`} className="text-base font-medium">{j.title}</Link>
                <div className="text-sm text-slate-600">Status: {j.status}</div>
              </div>
              <Link to={`/jobs/${j.id}`} className="px-3 py-2 rounded bg-slate-900 text-white">Open</Link>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {j.stages.map((s, i) => <StagePill key={i} s={s} />)}
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="text-slate-600">No jobs yet. Create one on the Upload page.</p>}
      </div>
    </div>
  )
}
