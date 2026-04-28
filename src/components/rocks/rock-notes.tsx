"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { addRockNote, deleteRockNote } from "@/app/actions/rocks";
import {
  TrashIcon,
  PlusIcon,
  MessageSquareIcon,
  AtSignIcon,
  XIcon,
  PaperclipIcon,
  FileIcon,
  ImageIcon,
  FileTextIcon,
  DownloadIcon,
  UploadCloudIcon,
} from "lucide-react";

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
};

type Note = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  attachments: Attachment[];
};

type User = {
  id: string;
  name: string;
};

type PendingFile = {
  file: File;
  uploading: boolean;
  uploaded?: { fileName: string; fileUrl: string; fileSize: number; fileType: string };
  error?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return ImageIcon;
  if (fileType.includes("pdf") || fileType.includes("document") || fileType.includes("text"))
    return FileTextIcon;
  return FileIcon;
}

export function RockNotes({
  rockId,
  notes,
  users,
}: {
  rockId: string;
  notes: Note[];
  users: User[];
}) {
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  function addMention(userId: string) {
    if (mentionedUsers.includes(userId)) return;
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setMentionedUsers([...mentionedUsers, userId]);
    const textarea = textareaRef.current;
    if (textarea) {
      const pos = textarea.selectionStart;
      const before = content.slice(0, pos);
      const after = content.slice(pos);
      setContent(`${before}@${user.name} ${after}`);
    } else {
      setContent((prev) => `${prev}@${user.name} `);
    }
    setShowMentionPicker(false);
  }

  function removeMention(userId: string) {
    setMentionedUsers(mentionedUsers.filter((id) => id !== userId));
  }

  async function uploadFile(file: File) {
    setPendingFiles((prev) => [...prev, { file, uploading: true }]);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });

      if (!res.ok) {
        const err = await res.json();
        setPendingFiles((prev) =>
          prev.map((pf) =>
            pf.file === file ? { ...pf, uploading: false, error: err.error || "Upload failed" } : pf
          )
        );
        return;
      }

      const data = await res.json();
      setPendingFiles((prev) =>
        prev.map((pf) =>
          pf.file === file
            ? { ...pf, uploading: false, uploaded: data }
            : pf
        )
      );
    } catch {
      setPendingFiles((prev) =>
        prev.map((pf) =>
          pf.file === file ? { ...pf, uploading: false, error: "Upload failed" } : pf
        )
      );
    }
  }

  function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      uploadFile(file);
    }
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Drag and drop handlers
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const uploadedFiles = pendingFiles.filter((pf) => pf.uploaded).map((pf) => pf.uploaded!);
    if (!content.trim() && uploadedFiles.length === 0) return;
    setAdding(true);
    const fd = new FormData();
    fd.set("rockId", rockId);
    fd.set("content", content.trim());
    for (const id of mentionedUsers) {
      fd.append("mentionedUserIds", id);
    }
    if (uploadedFiles.length > 0) {
      fd.set("attachments", JSON.stringify(uploadedFiles));
    }
    await addRockNote(fd);
    setContent("");
    setMentionedUsers([]);
    setPendingFiles([]);
    setAdding(false);
  }

  const availableUsers = users.filter((u) => !mentionedUsers.includes(u.id));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const allUploaded = pendingFiles.every((pf) => pf.uploaded || pf.error);
  const hasContent = content.trim() || pendingFiles.some((pf) => pf.uploaded);

  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No notes yet. Add updates on current actions below.</p>
      )}

      {notes.map((note) => (
        <div key={note.id} className="rounded-md border px-4 py-3 group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {note.content && <p className="text-sm whitespace-pre-wrap">{note.content}</p>}
              {/* Attachments */}
              {note.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {note.attachments.map((att) => {
                    const Icon = getFileIcon(att.fileType);
                    const isImage = att.fileType.startsWith("image/");
                    return (
                      <a
                        key={att.id}
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs hover:bg-muted/60 transition-colors group/att"
                      >
                        {isImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={att.fileUrl}
                            alt={att.fileName}
                            className="h-8 w-8 rounded object-cover"
                          />
                        ) : (
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium truncate block max-w-[200px]">{att.fileName}</span>
                          <span className="text-muted-foreground">{formatFileSize(att.fileSize)}</span>
                        </div>
                        <DownloadIcon className="h-3 w-3 text-muted-foreground opacity-0 group-hover/att:opacity-100 transition-opacity shrink-0" />
                      </a>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                {note.authorName} &middot; {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button
              onClick={() => deleteRockNote(note.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
            >
              <TrashIcon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
      ))}

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-2 mt-1 pt-2 border-t"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Mentioned users pills */}
        {mentionedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mentionedUsers.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200"
              >
                <AtSignIcon className="h-3 w-3" />
                {userMap[id]}
                <button type="button" onClick={() => removeMention(id)} className="hover:text-red-600 ml-0.5">
                  <XIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="text-xs text-muted-foreground self-center">will be notified</span>
          </div>
        )}

        <div className="flex gap-2">
          <MessageSquareIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-2.5" />
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              placeholder="Add a note, or drag & drop files here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
              className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring transition-colors ${
                isDragging ? "border-primary border-dashed bg-primary/5" : "border-input"
              }`}
            />
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md pointer-events-none">
                <div className="flex items-center gap-2 text-primary font-medium text-sm">
                  <UploadCloudIcon className="h-5 w-5" />
                  Drop files here
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 items-end justify-end">
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMentionPicker(!showMentionPicker)}
                className="h-8"
              >
                <AtSignIcon className="h-4 w-4" />
              </Button>
              {showMentionPicker && availableUsers.length > 0 && (
                <div className="absolute right-0 bottom-full mb-1 w-48 bg-card border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {availableUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addMention(u.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8"
            >
              <PaperclipIcon className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
            <Button type="submit" size="sm" disabled={adding || !hasContent || !allUploaded}>
              <PlusIcon className="h-4 w-4 mr-1" />
              {adding ? "..." : "Add"}
            </Button>
          </div>
        </div>

        {/* Pending files */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 ml-6">
            {pendingFiles.map((pf, i) => {
              const Icon = getFileIcon(pf.file.type);
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                    pf.error
                      ? "bg-red-50 border-red-200 text-red-700"
                      : pf.uploaded
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-[150px]">{pf.file.name}</span>
                  <span className="text-[10px]">({formatFileSize(pf.file.size)})</span>
                  {pf.uploading && <span className="animate-pulse">uploading...</span>}
                  {pf.error && <span>{pf.error}</span>}
                  <button type="button" onClick={() => removePendingFile(i)} className="hover:text-destructive">
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </form>
    </div>
  );
}
