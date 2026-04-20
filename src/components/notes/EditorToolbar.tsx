import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FONTS: { label: string; value: string }[] = [
  { label: "System",        value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { label: "Helvetica",     value: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Georgia",       value: "Georgia, 'Times New Roman', serif" },
  { label: "Comic Sans",    value: "'Comic Sans MS', 'Chalkboard SE', cursive" },
  { label: "Courier New",   value: "'Courier New', Courier, monospace" },
  { label: "Trebuchet MS",  value: "'Trebuchet MS', Helvetica, sans-serif" },
];

const HEADING_OPTIONS = [
  { label: "Paragraph", value: "paragraph" },
  { label: "Heading 1",  value: "h1" },
  { label: "Heading 2",  value: "h2" },
  { label: "Heading 3",  value: "h3" },
];

interface EditorToolbarProps {
  editor: Editor;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? FONTS[0].value;

  const currentHeading = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
    ? "h3"
    : "paragraph";

  const handleHeadingChange = (value: string) => {
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value[1]) as 1 | 2 | 3;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  const handleFontChange = (value: string) => {
    if (value === FONTS[0].value) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(value).run();
    }
  };

  return (
    <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border shrink-0 flex-wrap">
      {/* Font family */}
      <ToolbarSelect
        value={currentFont}
        onChange={handleFontChange}
        options={FONTS.map((f) => ({ label: f.label, value: f.value }))}
        style={{ fontFamily: currentFont }}
        width="w-32"
      />

      <Divider />

      {/* Heading / paragraph */}
      <ToolbarSelect
        value={currentHeading}
        onChange={handleHeadingChange}
        options={HEADING_OPTIONS}
        width="w-28"
      />

      <Divider />

      {/* Inline marks */}
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <Code size={13} />
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Task list"
      >
        <ListChecks size={13} />
      </ToolbarButton>

      <Divider />

      {/* Block types */}
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        <Quote size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code block"
      >
        <span className="text-[11px] font-mono font-semibold leading-none">{"<>"}</span>
      </ToolbarButton>

      <Divider />

      {/* Horizontal rule */}
      <ToolbarButton
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus size={13} />
      </ToolbarButton>
    </div>
  );
}

// ── Primitives ───────────────────────────────────────────────────────────────

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        "flex items-center justify-center w-6 h-6 rounded transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSelect({
  value,
  onChange,
  options,
  style,
  width = "w-24",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  style?: React.CSSProperties;
  width?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={style}
      className={cn(
        width,
        "h-6 bg-transparent border border-border/50 rounded text-[11px] text-muted-foreground hover:border-border hover:text-foreground transition-colors px-1.5 cursor-pointer outline-none focus:ring-1 focus:ring-ring"
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />;
}
