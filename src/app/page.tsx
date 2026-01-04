import { supabaseClient } from '@/lib/supabase';
import { TrendingUp, TrendingDown, BarChart3, Home, Layers, User } from 'lucide-react';

export default async function Beranda() {
  const { data: txs } = await supabaseClient
    .from('transactions')
    .select('id, description, amount, currency, created_at, tx_date, category_id, type, categories(name)')
    .order('created_at', { ascending: false });

  // Hitung statistik
  const incomeTotal = txs
    ?.filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const expenseTotal = txs
    ?.filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  // Statistik per kategori
  const categoryStats = txs?.reduce((acc: any, t) => {
    const cat = t.categories?.[0]?.name ?? 'Lainnya';
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += Number(t.amount);
    return acc;
  }, {}) ?? {};

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 pb-24">
      {/* Compact Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-blue-600">KasKu</h1>
      </header>

      <section className="px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-md p-6 border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-medium">Pemasukan</p>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-700">
              Rp {incomeTotal.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl shadow-md p-6 border border-red-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-medium">Pengeluaran</p>
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700">
              Rp {expenseTotal.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* Input Manual */}
        <ManualInput />

        {/* Statistik Kategori */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-800">Per Kategori</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(categoryStats).length > 0 ? (
              Object.entries(categoryStats).map(([cat, total]: [string, any]) => (
                <div key={cat} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700 font-medium">{cat}</span>
                  <span className="font-bold text-gray-900">
                    Rp {Number(total).toLocaleString('id-ID')}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">Belum ada transaksi</p>
            )}
          </div>
        </div>

        {/* List Transaksi */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-bold text-gray-800 text-base">Transaksi Terbaru</h2>
          </div>
          <ul className="divide-y">
            {txs && txs.length > 0 ? (
              txs.slice(0, 10).map((t) => (
                <li key={t.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {t.type === 'income' ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                      <p className="font-semibold text-gray-800 text-sm">{t.description}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.categories.name ?? 'Lainnya'} • {t.tx_date}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className={`font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'} Rp {Number(t.amount).toLocaleString('id-ID')}
                    </p>
                  </div>
                </li>
              ))
            ) : (
              <li className="p-4 text-center text-gray-500 text-sm">Belum ada transaksi</li>
            )}
          </ul>
        </div>
      </section>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 flex justify-around shadow-2xl md:hidden">
        <button className="flex flex-col items-center gap-1 text-blue-600 font-medium">
          <Home className="w-6 h-6" />
          <span className="text-xs">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition font-medium">
          <Layers className="w-6 h-6" />
          <span className="text-xs">Kategori</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition font-medium">
          <User className="w-6 h-6" />
          <span className="text-xs">Profil</span>
        </button>
      </nav>
    </main>
  );
}

function ManualInput() {
  async function handleSubmit(formData: FormData) {
    'use server';
    const text = formData.get('text')?.toString() ?? '';
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, telegram_user_id: 'web' }),
    });
    // TODO: revalidate atau redirect
  }

  return (
    <form action={handleSubmit} className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl shadow-md p-5 space-y-3">
      <label htmlFor="text" className="text-sm font-semibold text-white block">
        ✏️ Catat Transaksi
      </label>
      <input
        id="text"
        name="text"
        placeholder="Contoh: beli kopi 25k"
        className="w-full border-0 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 outline-none"
      />
      <button
        className="w-full bg-white text-blue-600 py-3 rounded-lg text-sm font-bold hover:bg-blue-50 transition shadow-md"
        type="submit"
      >
        💾 Catat
      </button>
    </form>
  );
}