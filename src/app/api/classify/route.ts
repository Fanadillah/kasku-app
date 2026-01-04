import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseServer } from '@/lib/supabase';

const SYSTEM_PROMPT = `kamu adalah asisten pencatatan keuangan, Tugas:
1) Ekstrak amount (angka) dalam IDR atau tulis currency jika ada.
2) Ekstrak description singkat (tanpa emoji).
3) Klasifikasikan ke salah satu kategori:
["Makanan & Minuman","Transportasi","Belanja","Tagihan & Utilitas","Hiburan","Kesehatan","Pendidikan","Investasi & Tabungan","Lainnya"].
4) Kembalikan dalam JSON valid dengan schema:
{"description": string, "amount": number, "currency": "IDR", "category": string}

Catatan:
- Jika jumlah tidak eksplisit, coba infer dari pola umum (mis: "25k" => 25000).
- Prioritaskan konsistensi JSON. hanya kirim JSON tanpa perjelasan tambahan.
`;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: NextRequest) {
    try {
        const { text, telegram_user_id } = await req.json();
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash'});
        const prompt = `${SYSTEM_PROMPT}\n\nTeks: """${text}"""`;

        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim();

        // Pastikan JSON
        const parsed = JSON.parse(raw);

        // Map user by telegram_user_id
        const { data: userRow } = await supabaseServer
            .from('users')
            .upsert({ telegram_user_id }, { onConflict: 'telegram_user_id' })
            .select()
            .single();

            // Ambil category_id by name
            const { data: cat } = await supabaseServer
            .from('categories')
            .select('id, name')
            .eq('name', parsed.category)
            .maybeSingle();

            // insert transaction
            const { error } = await supabaseServer.from('transactions').insert({
                user_id: userRow.id,
                description: parsed.description,
                amount: parsed.amount,
                currency: parsed.currency,
                source: 'telegram',
                tx_date: new Date().toISOString().slice(0, 10)
            });

            if ( error ) throw error;

            return NextResponse.json({ 
                ok: true,
                data: parsed,
                message: `Transaksi dicatat: ${parsed.category} - Rp ${Number(parsed.amount).toLocaleString('id-ID')}`,
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