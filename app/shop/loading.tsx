export default function ShopLoading() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-3">
          <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-200"/>
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200"/>
        </header>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2"><div className="h-4 w-24 animate-pulse rounded bg-slate-200"/><div className="h-8 w-52 animate-pulse rounded bg-slate-200"/></div>
          <div className="h-12 w-full max-w-sm animate-pulse rounded-xl bg-slate-200"/>
        </div>
        <div className="mt-6 flex gap-2 overflow-hidden">
          {Array.from({length:5}).map((_,index)=><div key={index} className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-slate-200"/>)}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({length:8}).map((_,index)=>(
            <div key={index} className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-soft">
              <div className="aspect-square bg-slate-200"/>
              <div className="space-y-2 p-3"><div className="h-3 w-2/3 rounded bg-slate-200"/><div className="h-4 w-full rounded bg-slate-200"/><div className="h-5 w-1/3 rounded bg-slate-200"/></div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
