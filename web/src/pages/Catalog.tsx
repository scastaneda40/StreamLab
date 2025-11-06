import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import PlayerWithMarkers from '../components/PlayerWithMarkers'

type Item = { id: string; title: string; hls: string; qcMarkers: {time:number; type:string; note:string}[] }

export default function Catalog() {
  const q = useQuery({
    queryKey: ['catalog'],
    queryFn: async () => (await api.get('/catalog')).data,
    refetchInterval: 3000
  })
  const items: Item[] = q.data ?? []
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Catalog</h2>
      {items.length === 0 && <p className="text-slate-600">Nothing published yet.</p>}
      <div className="space-y-8">
        {items.map(it => (
          <div key={it.id} className="bg-white border rounded p-4">
            <h3 className="font-medium mb-2">{it.title}</h3>
            <PlayerWithMarkers src={it.hls} markers={it.qcMarkers} />
          </div>
        ))}
      </div>
    </div>
  )
}
