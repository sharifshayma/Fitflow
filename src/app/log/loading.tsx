export default function LogLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted rounded" />
          <div className="space-y-2">
            <div className="h-7 w-28 bg-muted rounded" />
            <div className="h-4 w-40 bg-muted rounded" />
          </div>
          <div className="h-10 w-10 bg-muted rounded" />
        </div>
        <div className="h-12 w-12 bg-muted rounded-full" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="flex gap-2 mt-2">
                <div className="h-6 w-24 bg-muted rounded-full" />
                <div className="h-6 w-20 bg-muted rounded-full" />
              </div>
            </div>
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
