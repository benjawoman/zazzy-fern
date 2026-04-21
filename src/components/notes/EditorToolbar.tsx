import type { Editor } from "@tiptap/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
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
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FONTS: { label: string; value: string }[] = [
  { label: "System",          value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { label: "Helvetica",       value: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Georgia",         value: "Georgia, 'Times New Roman', serif" },
  { label: "Comic Sans",      value: "'Comic Sans MS', 'Chalkboard SE', cursive" },
  { label: "Courier New",     value: "'Courier New', Courier, monospace" },
  { label: "Trebuchet MS",    value: "'Trebuchet MS', Helvetica, sans-serif" },
];

const HEADING_OPTIONS: { label: string; value: string; size: string; weight: string }[] = [
  { label: "Paragraph", value: "paragraph", size: "0.8125rem", weight: "400" },
  { label: "Heading 1", value: "h1",        size: "1.25rem",   weight: "700" },
  { label: "Heading 2", value: "h2",        size: "1.05rem",   weight: "700" },
  { label: "Heading 3", value: "h3",        size: "0.9rem",    weight: "600" },
  { label: "Heading 4", value: "h4",        size: "0.8125rem", weight: "600" },
];

interface EditorToolbarProps {
  editor: Editor;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const currentFont =
    (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? FONTS[0].value;

  const currentHeading = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
    ? "h3"
    : editor.isActive("heading", { level: 4 })
    ? "h4"
    : "paragraph";

  const handleHeadingChange = (value: string) => {
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value[1]) as 1 | 2 | 3 | 4;
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
      <FontPicker currentFont={currentFont} onChange={handleFontChange} />

      <Divider />

      {/* Heading / paragraph */}
      <HeadingPicker currentHeading={currentHeading} onChange={handleHeadingChange} />

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

// ── FontPicker ────────────────────────────────────────────────────────────────

function FontPicker({
  currentFont,
  onChange,
}: {
  currentFont: string;
  onChange: (v: string) => void;
}) {
  const currentLabel = FONTS.find((f) => f.value === currentFont)?.label ?? "System";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-1 h-6 w-32 px-1.5 border border-border/50 rounded text-[11px] text-muted-foreground hover:border-border hover:text-foreground transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-ring"
          style={{ fontFamily: currentFont }}
        >
          <span className="flex-1 text-left truncate">{currentLabel}</span>
          <ChevronDown size={9} className="shrink-0 opacity-50" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          className="z-50 min-w-44 rounded-md border border-border bg-popover py-1 shadow-2xl"
        >
          {FONTS.map((font) => (
            <DropdownMenu.Item
              key={font.value}
              onSelect={() => onChange(font.value)}
              style={{ fontFamily: font.value }}
              className={cn(
                "flex items-center px-3 py-1.5 text-sm cursor-pointer outline-none select-none hover:bg-accent focus:bg-accent",
                font.value === currentFont
                  ? "text-primary"
                  : "text-popover-foreground"
              )}
            >
              {font.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ── HeadingPicker ─────────────────────────────────────────────────────────────

function HeadingPicker({
  currentHeading,
  onChange,
}: {
  currentHeading: string;
  onChange: (v: string) => void;
}) {
  const currentOption =
    HEADING_OPTIONS.find((h) => h.value === currentHeading) ?? HEADING_OPTIONS[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1 h-6 w-28 px-1.5 border border-border/50 rounded text-[11px] text-muted-foreground hover:border-border hover:text-foreground transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-ring">
          <span className="flex-1 text-left truncate">{currentOption.label}</span>
          <ChevronDown size={9} className="shrink-0 opacity-50" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          className="z-50 min-w-44 rounded-md border border-border bg-popover py-1 shadow-2xl"
        >
          {HEADING_OPTIONS.map((opt) => (
            <DropdownMenu.Item
              key={opt.value}
              onSelect={() => onChange(opt.value)}
              style={{ fontSize: opt.size, fontWeight: opt.weight }}
              className={cn(
                "flex items-center px-3 py-2 cursor-pointer outline-none select-none hover:bg-accent focus:bg-accent",
                opt.value === currentHeading
                  ? "text-primary"
                  : "text-popover-foreground"
              )}
            >
              {opt.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────────

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
        "flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />;
}
