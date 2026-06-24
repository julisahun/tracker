// Shared TipTap configuration for editing a Markdown body. Used by the item
// editor (DocEditor) and the per-folder note (FolderNote) so both render and
// round-trip Markdown identically.

import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import type { EditorOptions } from "@tiptap/react";

/** The block/mark extensions backing the WYSIWYG Markdown body. */
export const bodyExtensions = [
  StarterKit,
  TaskList,
  TaskItem.configure({ nested: true }),
  Link.configure({ openOnClick: false, autolink: true }),
  Markdown.configure({ html: false, transformPastedText: true }),
];

/** Shared `editorProps` for the contenteditable host. */
export const bodyEditorProps: EditorOptions["editorProps"] = {
  // `notranslate` / translate="no" keep translation extensions (Google
  // Translate, DeepL, …) from rewriting the contenteditable's text nodes,
  // which corrupts the DOM React manages and crashes the reconciler on the
  // next commit (NotFoundError: insertBefore … not a child).
  attributes: {
    class: "tracker-prose notranslate focus:outline-none",
    translate: "no",
  },
};
