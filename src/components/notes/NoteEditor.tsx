import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import CharacterCount from "@tiptap/extension-character-count";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { useState, useEffect, useRef, useCallback } from "react";
import { getNoteContent, saveNoteContent, updateNoteTitle } from "@/lib/tauri";
import type { Note } from "@/types";
import { EditorToolbar } from "./EditorToolbar";

interface NoteEditorProps {
  note: Note;
  onNoteUpdated: (updated: Partial<Note> & { id: string }) => void;
}

export function NoteEditor({ note, onNoteUpdated }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const noteIdRef = useRef(note.id);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleSave = useCallback((noteId: string, html: string, wordCount: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      await saveNoteContent({ id: noteId, content: html, wordCount });
      setSaveStatus("saved");
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, 800);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Typography.configure({}),
      Link.configure({ openOnClick: false }),
      CharacterCount.configure({}),
      TaskList.configure({}),
      TaskItem.configure({ nested: true }),
      TextStyle.configure({}),
      FontFamily.configure({}),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const id = noteIdRef.current;
      const html = editor.getHTML();
      const words = (editor.storage.characterCount?.words?.() as number) ?? 0;
      scheduleSave(id, html, words);
    },
    editorProps: {
      attributes: { class: "note-editor focus:outline-none" },
    },
  });

  // When note changes: flush pending save for previous note, load new content
  useEffect(() => {
    if (editor && saveTimerRef.current && noteIdRef.current !== note.id) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
      const html = editor.getHTML();
      const words = (editor.storage.characterCount?.words?.() as number) ?? 0;
      saveNoteContent({ id: noteIdRef.current, content: html, wordCount: words });
    }

    noteIdRef.current = note.id;
    setTitle(note.title);
    setSaveStatus("idle");

    if (!editor) return;

    getNoteContent(note.id).then((content) => {
      editor.commands.setContent(content || "", { emitUpdate: false });
    });
  }, [note.id, editor]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => {
      await updateNoteTitle({ id: noteIdRef.current, title: value });
      onNoteUpdated({ id: noteIdRef.current, title: value });
    }, 600);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      editor?.commands.focus("start");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Save indicator */}
      <div className="flex items-center justify-end px-8 pt-4 pb-0 h-8 shrink-0">
        {saveStatus !== "idle" && (
          <span className="text-[11px] text-muted-foreground/40 transition-opacity">
            {saveStatus === "saving" ? "Saving…" : "Saved"}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="px-8 pb-1 shrink-0">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          className="w-full bg-transparent border-none outline-none text-[26px] font-bold text-foreground placeholder:text-muted-foreground/25 leading-tight"
          placeholder="Untitled"
        />
      </div>

      {/* Formatting toolbar */}
      {editor && <EditorToolbar editor={editor} />}

      {/* Editor */}
      <div
        className="flex-1 overflow-y-auto px-8 pb-12 pt-4 cursor-text"
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
