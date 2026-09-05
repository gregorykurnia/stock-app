"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
          : "border-[var(--border)] hover:bg-black/[0.03]"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px bg-[var(--border)] mx-1" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    const url = window.prompt("Image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const addTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  return (
    <div className="p-2 border-b border-[var(--border)] flex flex-wrap items-center gap-1">
      <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↺</ToolbarButton>
      <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↻</ToolbarButton>
      <Divider />
      <ToolbarButton title="Paragraph" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()}>¶</ToolbarButton>
      <ToolbarButton title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolbarButton>
      <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
      <ToolbarButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
      <Divider />
      <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolbarButton>
      <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolbarButton>
      <ToolbarButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolbarButton>
      <ToolbarButton title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>{"</>"}</ToolbarButton>
      <ToolbarButton title="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>H</ToolbarButton>
      <Divider />
      <input
        type="color"
        title="Text color"
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        className="w-6 h-6 border border-[var(--border)] rounded cursor-pointer"
      />
      <ToolbarButton title="Clear color" onClick={() => editor.chain().focus().unsetColor().run()}>✕</ToolbarButton>
      <Divider />
      <ToolbarButton title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>⯇</ToolbarButton>
      <ToolbarButton title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>≡</ToolbarButton>
      <ToolbarButton title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>⯈</ToolbarButton>
      <Divider />
      <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</ToolbarButton>
      <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolbarButton>
      <ToolbarButton title="Task list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>☑ Task</ToolbarButton>
      <ToolbarButton title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>&ldquo;</ToolbarButton>
      <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"{ }"}</ToolbarButton>
      <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</ToolbarButton>
      <Divider />
      <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>🔗</ToolbarButton>
      <ToolbarButton title="Image" onClick={addImage}>🖼</ToolbarButton>
      <ToolbarButton title="Table" onClick={addTable}>⊞</ToolbarButton>
      {editor.isActive("table") && (
        <>
          <ToolbarButton title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>+Col</ToolbarButton>
          <ToolbarButton title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>+Row</ToolbarButton>
          <ToolbarButton title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>🗑Table</ToolbarButton>
        </>
      )}
    </div>
  );
}

export default function NoteEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "note-prose flex-1 overflow-y-auto p-4 text-sm leading-relaxed outline-none",
      },
    },
  });

  // Sync external content changes (e.g. switching active document) into the editor.
  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="flex-1 flex flex-col min-h-0 overflow-y-auto" />
      <style jsx global>{`
        .note-prose { min-height: 100%; }
        .note-prose h1 { font-size: 1.6rem; font-weight: 700; margin: 0.6em 0 0.3em; }
        .note-prose h2 { font-size: 1.3rem; font-weight: 700; margin: 0.6em 0 0.3em; }
        .note-prose h3 { font-size: 1.1rem; font-weight: 600; margin: 0.5em 0 0.3em; }
        .note-prose p { margin: 0.4em 0; }
        .note-prose ul:not([data-type="taskList"]) { list-style: disc; padding-left: 1.5em; margin: 0.4em 0; }
        .note-prose ol { list-style: decimal; padding-left: 1.5em; margin: 0.4em 0; }
        .note-prose blockquote { border-left: 3px solid var(--border); padding-left: 0.75em; color: var(--muted); margin: 0.4em 0; }
        .note-prose pre { background: #1e1e1e; color: #e5e5e5; padding: 0.75em 1em; border-radius: 6px; overflow-x: auto; margin: 0.5em 0; }
        .note-prose code { background: rgba(0,0,0,0.06); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.85em; }
        .note-prose pre code { background: none; padding: 0; }
        .note-prose hr { border: none; border-top: 1px solid var(--border); margin: 1em 0; }
        .note-prose a { color: var(--accent); text-decoration: underline; }
        .note-prose img { max-width: 100%; border-radius: 6px; }
        .note-prose table { border-collapse: collapse; margin: 0.5em 0; width: 100%; }
        .note-prose th, .note-prose td { border: 1px solid var(--border); padding: 0.4em 0.6em; text-align: left; }
        .note-prose th { background: rgba(0,0,0,0.03); font-weight: 600; }
        .note-prose ul[data-type="taskList"] { list-style: none; padding-left: 0.25em; margin: 0.4em 0; }
        .note-prose ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
        .note-prose ul[data-type="taskList"] li > label { margin-top: 0.2em; }
        .note-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--muted);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
