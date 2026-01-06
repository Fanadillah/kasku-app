import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
    try {

        if (req.headers.get("x-telegram-bot-api-secret-token") !== process.env.TELEGRAM_WEBHOOK_SECRET) {
            return NextResponse.json({ok: false}, { status: 401 });
        }
        const update = await req.json();

                // handle callback_query (inline button press)
        if (update?.callback_query) {
            const cb = update.callback_query;
            const fromId = cb.from?.id?.toString();
            const data = cb.data;
            const message = cb.message;

            // ack callback to remove loading spinner
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cb.id }),
            });

            if (data === 'menu') {
                // edit message to show main menu
                await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: message.chat.id,
                        message_id: message.message_id,
                        text: 'Menu KasKu — pilih aksi:',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '✏️ Catat Transaksi', callback_data: 'catat' }],
                                [{ text: '📈 Statistik', callback_data: 'stats' }, { text: '📂 Kategori', callback_data: 'categories' }],
                                [{ text: '❓ Bantuan', callback_data: 'help' }]
                            ]
                        }
                    }),
                });
                return NextResponse.json({ ok: true });
            }

            if (data === 'catat') {
                // ask user to send transaction text
                await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: fromId,
                        text: 'Kirimkan deskripsi transaksi Anda. Contoh: "Beli kopi 25k di Starbucks".',
                        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu' }]] }
                    }),
                });
                return NextResponse.json({ ok: true });
            }

            if (data === 'stats') {
                // try fetch summary from internal API, fallback to placeholder
                try {
                    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/stats?user=${fromId}`);
                    const stats = await r.json();
                    const text = stats?.ok
                        ? `📊 Statistik\n\nPemasukan: Rp ${Number(stats.income ?? 0).toLocaleString('id-ID')}\nPengeluaran: Rp ${Number(stats.expense ?? 0).toLocaleString('id-ID')}`
                        : '📊 Statistik saat ini tidak tersedia.';
                    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: fromId,
                            text,
                            reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu' }]] }
                        }),
                    });
                } catch {
                    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: fromId,
                            text: '📊 Gagal mengambil statistik. Coba lagi nanti.',
                            reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu' }]] }
                        }),
                    });
                }
                return NextResponse.json({ ok: true });
            }

            if (data === 'categories') {
                await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: fromId,
                        text: '📂 Kategori tersedia:\n- Makanan & Minuman\n- Transportasi\n- Belanja\n- Tagihan & Utilitas\n- Hiburan\n- Kesehatan\n- Pendidikan\n- Investasi & Tabungan\n- Lainnya',
                        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu' }]] }
                    }),
                });
                return NextResponse.json({ ok: true });
            }

            if (data === 'help') {
                await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: fromId,
                        text: '❓ Bantuan:\n- /menu : Tampilkan menu\n- Kirim teks transaksi untuk mencatat\nContoh: "Beli makan 25k".',
                        reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'menu' }]] }
                    }),
                });
                return NextResponse.json({ ok: true });
            }

            return NextResponse.json({ ok: true });
        }
        
        const msg = update?.message?.text;
        const fromId = update?.message?.from?.id?.toString();

        if (!msg || !fromId) {
            return NextResponse.json({ ok: true });
        }

        // Handle /start command early and return before calling classification
        if (msg?.trim() === "/start") {
            const replyText = `Halo! Saya adalah bot pengelola keuangan Anda. Kirimkan deskripsi singkat tentang transaksi Anda, dan saya akan mencatatnya untuk Anda. Misalnya: "Beli kopi 25k di Starbucks".`;
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: fromId,
                    text: replyText,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✏️ Catat Transaksi', callback_data: 'catat' }],
                            [{ text: '📈 Statistik', callback_data: 'stats' }, { text: '📂 Kategori', callback_data: 'categories' }],
                            [{ text: '❓ Bantuan', callback_data: 'help' }]
                        ]
                    }
                }),
            });

            return NextResponse.json({ ok: true });
        }

        // Panggil clasify endpoint internal
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ text: msg, telegram_user_id: fromId }),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`Classify API error: ${res.status}`, text);
            return NextResponse.json({ ok: false, error: `Classify API returned ${res.status}` }, { status: 200 });
        }

        let result;
        try {
            result = await res.json();
        } catch (e) {
            console.error('Failed to parse classify response as JSON:', e);
            return NextResponse.json({ ok: false, error: 'Invalid response from classify API' }, { status: 200 });
        }

        // Balas ke user lewat telegram sendMessage
        let replyText: string;
        if (result.ok) {
            const items = result.data ?? [];
            const itemsArr = Array.isArray(items) ? items : [items];

            const details = itemsArr
                .map((it: any, idx: number) => {
                    const icon = it.type === 'income' ? '💰' : it.type === 'expense' ? '💸' : '🔄';
                    const amt = Number(it.amount);
                    const amtStr = Number.isFinite(amt) ? `Rp ${amt.toLocaleString('id-ID')}` : String(it.amount ?? '-');
                    const category = it.category ?? 'Lainnya';
                    const desc = it.description ?? '-';
                    const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    return `${idx + 1}. ${icon} <b>${desc}</b>\n   💵 ${amtStr} | 📂 ${category}\n   📅 ${now} ⏰ ${time}`;
                })
                .join('\n\n');

            replyText = `✅ ${result.message}\n\n<b>Detail Transaksi:</b>\n${details}`;
        } else {
            replyText = `❌ Gagal memproses: ${result.error}`;
        }

        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: fromId,
                text: replyText,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: '📋 Menu', callback_data: 'menu' }]] }
            }),
        });

        return NextResponse.json({ ok: true});
    }catch (e: any) {
        return NextResponse.json({ok: false, error: e.message}, { status: 200});
    }
}