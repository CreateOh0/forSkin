import { Loader2 } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="h-8 w-32 bg-muted rounded animate-pulse mb-6" />
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-48 bg-muted rounded-lg animate-pulse mb-8" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    </main>
  )
}
