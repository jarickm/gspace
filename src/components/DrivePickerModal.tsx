import React, { useState, useEffect } from 'react';
import type { DriveAttachment, GoogleDriveFile } from '../types/gqueues';
import { fetchDriveFiles } from '../services/driveApi';
import {
  HardDrive,
  Search,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  X,
  Loader2,
  ExternalLink,
  Plus,
  Link as LinkIcon
} from 'lucide-react';

interface DrivePickerModalProps {
  isOpen: boolean;
  accessToken: string;
  onClose: () => void;
  onSelectFile: (attachment: DriveAttachment) => void;
}

export const DrivePickerModal: React.FC<DrivePickerModalProps> = ({
  isOpen,
  accessToken,
  onClose,
  onSelectFile,
}) => {
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direct link input state
  const [customLink, setCustomLink] = useState('');
  const [customTitle, setCustomTitle] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const debounceTimer = setTimeout(async () => {
      try {
        const driveFiles = await fetchDriveFiles(accessToken, searchQuery);
        if (isMounted) {
          setFiles(driveFiles);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(err);
          setError('Could not load Google Drive files. Check permissions.');
          setLoading(false);
        }
      }
    }, searchQuery ? 300 : 0);

    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
    };
  }, [isOpen, accessToken, searchQuery]);

  if (!isOpen) return null;

  const getMimeIcon = (mimeType: string) => {
    if (mimeType.includes('document')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    }
    if (mimeType.includes('spreadsheet')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    if (mimeType.includes('presentation')) {
      return <Presentation className="w-5 h-5 text-amber-600" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const handleSelect = (f: GoogleDriveFile) => {
    onSelectFile({
      id: f.id,
      name: f.name,
      url: f.webViewLink,
      mimeType: f.mimeType,
    });
    onClose();
  };

  const handleAddCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLink.trim()) return;

    onSelectFile({
      id: 'custom-' + Date.now(),
      name: customTitle.trim() || customLink.trim(),
      url: customLink.trim(),
      mimeType: 'application/vnd.google-apps.custom-link',
    });
    setCustomLink('');
    setCustomTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Attach from Google Drive</h3>
              <p className="text-xs text-slate-500">Pick files directly from your Google Workspace Drive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Google Docs, Sheets, Slides, PDFs..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg outline-none transition-all"
            />
          </div>
        </div>

        {/* Files List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Loading files from Google Drive...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-600 text-xs">{error}</div>
          ) : files.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <File className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No files found</p>
              <p className="text-xs text-slate-400 mt-1">Try a different search term or paste a link below</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleSelect(file)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-white transition-colors">
                      {getMimeIcon(file.mimeType)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-700">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {file.modifiedTime
                          ? `Modified ${new Date(file.modifiedTime).toLocaleDateString()}`
                          : 'Google Workspace File'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white rounded-lg transition-colors"
                    >
                      Attach
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Or add custom link section */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <p className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-slate-500" /> Or paste any Google Doc or Workspace link:
          </p>
          <form onSubmit={handleAddCustomLink} className="flex gap-2">
            <input
              type="text"
              placeholder="Title (optional)"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-1/3 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
            <input
              type="url"
              placeholder="https://docs.google.com/..."
              value={customLink}
              onChange={(e) => setCustomLink(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!customLink.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Add Link
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
