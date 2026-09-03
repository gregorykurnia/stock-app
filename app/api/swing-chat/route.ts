import { NextRequest, NextResponse } from "next/server";
import { askSwingChat, type ChatMessage } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { dataContext, messages } = (await req.json()) as {
      dataContext: string;
      messages: ChatMessage[];
    };

    if (!dataContext || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing dataContext or messages" }, { status: 400 });
    }

    const reply = await askSwingChat(dataContext, messages);
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
