export default function RouteLoading() {
  return (
    <main className="min-h-screen bg-[#f5f8fc] px-4 py-8" aria-label="بارکردنی لاپەڕە">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-3 rounded-2xl bg-[#0a2d50] px-4 py-4">
          <div className="h-9 w-32 animate-pulse rounded-lg bg-white/20"/>
          <div className="h-9 w-24 animate-pulse rounded-lg bg-white/20"/>
        </header>
        <div className="mt-8 space-y-3">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200"/>
          <div className="h-8 w-56 animate-pulse rounded bg-slate-200"/>
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-200"/>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({length:8}).map((_,index)=>(
            <div key={index} className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="aspect-square bg-slate-200"/>
              <div className="space-y-2 p-3"><div className="h-3 w-2/3 rounded bg-slate-200"/><div className="h-4 w-full rounded bg-slate-200"/><div className="h-5 w-1/3 rounded bg-slate-200"/></div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
