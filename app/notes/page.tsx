"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getNotes, createNote, updateNote, deleteNote } from "@/lib/firestore";
import type { NoteDoc } from "@/lib/types";
import NoteEditor from "@/components/NoteEditor";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = notes.find((n) => n.id === activeId) || null;

  const refresh = useCallback(async () => {
    const list = await getNotes();
    setNotes(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      const list = await refresh();
      setLoading(false);
      if (list.length > 0) {
        setActiveId(list[0].id);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (active) setTitleDraft(active.title);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback(
    (patch: { title?: string; content?: string }) => {
      if (!activeId) return;
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await updateNote(activeId, patch);
        setNotes((prev) =>
          prev
            .map((n) => (n.id === activeId ? { ...n, ...patch, updated_at: new Date().toISOString() } : n))
            .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        );
        setSaveState("saved");
      }, 500);
    },
    [activeId]
  );

  async function handleNewNote() {
    const id = await createNote("Untitled document");
    await refresh();
    setActiveId(id);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    await deleteNote(id);
    const list = await refresh();
    if (activeId === id) {
      setActiveId(list.length > 0 ? list[0].id : null);
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex flex-col">
      <div className="flex gap-6 flex-1 min-h-[70vh]">
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="font-semibold text-sm">Documents</h2>
            <button
              onClick={handleNewNote}
              className="text-xs px-2 py-1 rounded-md bg-[var(--accent)] text-white hover:opacity-90"
            >
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-3 text-sm text-[var(--muted)]">Loading…</div>}
            {!loading && notes.length === 0 && (
              <div className="p-3 text-sm text-[var(--muted)]">No documents yet.</div>
            )}
            {notes.map((n) => (
              <button
                key={n.id}
                onClick={() => setActiveId(n.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-[var(--border)] hover:bg-black/[0.03] transition-colors ${
                  n.id === activeId ? "bg-black/[0.04]" : ""
                }`}
              >
                <div className="text-sm font-medium truncate">{n.title || "Untitled"}</div>
                <div className="text-xs text-[var(--muted)]">{formatDate(n.updated_at)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col border border-[var(--border)] rounded-lg overflow-hidden min-h-0">
          {!active && (
            <div className="flex-1 flex items-center justify-center text-sm text-[var(--muted)]">
              Select or create a document to get started.
            </div>
          )}
          {active && (
            <>
              <div className="p-3 border-b border-[var(--border)] flex items-center gap-3">
                <input
                  value={titleDraft}
                  onChange={(e) => {
                    setTitleDraft(e.target.value);
                    scheduleSave({ title: e.target.value });
                  }}
                  placeholder="Untitled document"
                  className="flex-1 text-lg font-semibold outline-none bg-transparent"
                />
                <span className="text-xs text-[var(--muted)] shrink-0">
                  {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
                </span>
                <button
                  onClick={() => handleDelete(active.id)}
                  className="text-xs px-2 py-1 rounded-md text-red-600 hover:bg-red-50 shrink-0"
                >
                  Delete
                </button>
              </div>
              <NoteEditor
                key={active.id}
                content={active.content}
                onChange={(html) => scheduleSave({ content: html })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
