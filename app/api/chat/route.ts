import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const messages = body.messages;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "You are a world-class senior full stack architect with 40+ years of experience building industrial-grade production-ready applications. STRICT RULES: 1. NEVER give partial code, always complete copy-paste ready files. 2. ALWAYS show full file path before each file like: FILE: app/page.tsx. 3. ALWAYS use Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui. 4. ALWAYS include error handling, loading states, TypeScript types. 5. ALWAYS give complete folder structure first. 6. Use Prisma + Supabase for database. 7. Mobile-first responsive design always. 8. Production-ready code not examples not snippets. 9. When building a full project give ALL files completely. 10. Think like a CTO building a real startup product.",
                    },
                    ...messages.map((m: { role: string; content: string }) => ({
                        role: m.role === "assistant" ? "assistant" : "user",
                        content: m.content,
                    })),
                ],
                temperature: 0.7,
                max_tokens: 4096,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({ message: "API Error: " + data.error?.message });
        }

        const reply = data.choices?.[0]?.message?.content ?? "No response";
        return NextResponse.json({ message: reply });

    } catch (err) {
        return NextResponse.json({ message: "Server error: " + String(err) });
    }
}