import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseServer } from '@/lib/supabase';

const SYSTEM_PROMPT = `kamu adalah asisten pencatatan keuangan, Tugas:
1) Ekstrak amount (angka) dalam IDR atau tulis currency jika ada.
2) Ekstrak description singkat (tanpa emoji).
3) Klasifikasikan ke salah satu kategori:
["Makanan & Minuman","Transportasi","Belanja","Tagihan & Utilitas","Hiburan","Kesehatan","Pendidikan","Investasi & Tabungan","Lainnya"].
4) Kembalikan dalam JSON valid dengan schema:
{"description": string, "amount": number, "currency": "IDR", "category": string, "type": "income" | "expense"} 

Catatan:
- Jika jumlah tidak eksplisit, coba infer dari pola umum (mis: "25k" => 25000).
- Prioritaskan konsistensi JSON. hanya kirim JSON tanpa perjelasan tambahan.
- Jika teks mengandung kata seperti "gaji", "bonus", "bayaran", "transfer masuk", set type="income".
- Jika teks mengandung kata seperti "beli", "bayar", "makan", "tagihan", set type="expense".

`;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: NextRequest) {
    try {
        const { text, telegram_user_id } = await req.json();
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite'});
        const prompt = `${SYSTEM_PROMPT}\n\nTeks: """${text}"""`;

        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim();

        const cleaned = (() => {
            // hapus fance ```json atau ```
            const noFence = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
            //jika masih bukan JSON yang valid ekstrak dari first { to last }
            let first = noFence.indexOf('[');
            let last = noFence.lastIndexOf(']');

            if (first === -1) {
                first = noFence.indexOf('{');
                last = noFence.lastIndexOf('}');
            }
            if (first !== -1 && last !== -1 && last > first) return noFence.slice(first, last + 1);
            return noFence;

        })();

        // Pastikan JSON
                console.log('RAW:', JSON.stringify(raw));
        console.log('CLEANED:', JSON.stringify(cleaned));
        const parsed = JSON.parse(cleaned);

        //normalize ke array (support 1 objek atau banyak objek)
        const items = Array.isArray(parsed) ? parsed : [parsed];

        // Map user by telegram_user_id
        const { data: userRow } = await supabaseServer
            .from('users')
            .upsert({ telegram_user_id }, { onConflict: 'telegram_user_id' })
            .select()
            .single();

        const rows: any [] = [];
        for (const it of items) {
            if (!it.description || it.amount == null || !it.currency || !it.category){
                return NextResponse.json({ ok: false, error: 'Invalid item format' }, { status: 400});

            }
            // Ambil category_id by name
            const { data: cat } = await supabaseServer
            .from('categories')
            .select('id, name')
            .eq('name', it.category)
            .maybeSingle();
            
            rows.push({
                user_id: userRow.id,
                description: it.description,
                amount: it.amount,
                currency: it.currency,
                category_id: cat?.id ?? null,
                source: 'telegram',
                tx_date: new Date().toISOString().slice(0, 10),
                type: it.type,
            });

        }


            // insert transaction
            const { error } = await supabaseServer.from('transactions').insert(rows);

            if ( error ) throw error;

            let expenseTotal = 0;
            let incomeTotal = 0;
            let msg = '';
            if(rows.map(r => r.type).includes('expense')){
                expenseTotal = rows
                    .filter(r => r.type === 'expense')
                    .reduce((sum, r) => sum + Number(r.amount), 0);
            }
            if(rows.map(r => r.type).includes('income')){
                incomeTotal = rows
                    .filter(r => r.type === 'income')
                    .reduce((sum, r) => sum + Number(r.amount), 0);
            }
            if(expenseTotal <= 0) {
                msg =  `Transaksi dicatat:\n -Pemasukan Rp ${Number(incomeTotal).toLocaleString('id-ID')}`.trim();
            }
            else if(incomeTotal <= 0) {
                msg = `Transaksi dicatat:\n -Pengeluaran Rp ${Number(expenseTotal).toLocaleString('id-ID')}`.trim();
            }else{
                msg = `Transaksi dicatat: \n -Pengeluaran Rp ${Number(expenseTotal).toLocaleString('id-ID')}\n -Pemasukan Rp ${Number(incomeTotal).toLocaleString('id-ID')}`.trim();
            }

            return NextResponse.json({ 
                ok: true,
                data: parsed,
                message: msg,
            });
    }catch (e: any) {
        return NextResponse.json({ 
            ok: false,
            error: e.message ?? 'error'
        },
            {
                status: 400
            }
    );  
    }
}