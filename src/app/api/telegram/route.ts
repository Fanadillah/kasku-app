import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const update = await req.json();
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
                    parse_mode: 'HTML',
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
        const result = await res.json();

        // Balas ke user lewat telegram sendMessage
        let replyText = result.ok
            ? `✅ ${result.message}\n\nDetail:\n- Deskripsi: ${result.data.description}\n- Jumlah: Rp ${Number(result.data.amount).toLocaleString('id-ID')}\n- Kategori: ${result.data.category}`
            : `❌ Gagal memproses: ${result.error}` ;

        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: fromId,
                text: replyText,
                parse_mode: 'HTML',
            }),
        });

        return NextResponse.json({ ok: true});
    }catch (e: any) {
        return NextResponse.json({ok: false, error: e.message}, { status: 200});
    }
}