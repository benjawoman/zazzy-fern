import { create } from "zustand";
import type { Folder } from "@/types";
import { getFolderTree, createFolder, updateFolder, deleteFolder } from "@/lib/tauri";

interface FolderState {
  folders: Folder[];
  expandedIds: Set<string>;
  loading: boolean;
  error: string | null;

  loadFolders: () => Promise<void>;
  createFolder: (args: {
    name: string;
    parentId?: string | null;
    color?: string | null;
    icon?: string | null;
  }) => Promise<Folder>;
  updateFolder: (args: {
    id: string;
    name?: string;
    color?: string | null;
    icon?: string | null;
    parentId?: string | null;
  }) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  expandedIds: new Set(),
  loading: false,
  error: null,

  loadFolders: async () => {
    set({ loading: true, error: null });
    try {
      const folders = await getFolderTree();
      set({ folders, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createFolder: async (args) => {
    const folder = await createFolder(args);
    await get().loadFolders();
    return folder;
  },

  updateFolder: async (args) => {
    await updateFolder(args);
    await get().loadFolders();
  },

  deleteFolder: async (id) => {
    await deleteFolder(id);
    await get().loadFolders();
  },

  toggleExpanded: (id) =>
    set((state) => {
      const next = new Set(state.expandedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedIds: next };
    }),

  setExpanded: (id, expanded) =>
    set((state) => {
      const next = new Set(state.expandedIds);
      if (expanded) next.add(id);
      else next.delete(id);
      return { expandedIds: next };
    }),
}));
