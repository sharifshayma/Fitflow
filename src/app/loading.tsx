export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-36 bg-muted rounded" />
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 bg-muted rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-5 w-20 bg-muted rounded" />
          </div>
          <div className="h-2 w-full bg-muted rounded-full" />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="flex-1 h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
