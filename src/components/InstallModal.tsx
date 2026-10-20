import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Apple,
  Monitor,
  CheckCircle2,
  Share2,
  PlusSquare,
  X,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileBox,
  Copy,
  Check
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isWindows, install } = usePWAInstall();

  const defaultTab = isIOS ? 'ios' : isWindows ? 'windows' : 'android';
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'windows'>('android');
  const [isInstalling, setIsInstalling] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const standaloneAppUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://ais-dev-enxnpelbddd7tflkv7rfjd-462514151820.asia-east1.run.app';

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(standaloneAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleInstallClick = async () => {
    setIsInstalling(true);
    await install();
    setIsInstalling(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Download & Install GQueues App</h3>
              <p className="text-xs text-slate-500">Direct Download to Downloads Folder • Android APK • iOS • Windows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Why Google Studio was installed banner */}
        <div className="p-3 bg-blue-50/80 border-b border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Why did the browser say "Google Studio"?</span>
            <p className="text-blue-800 text-[11px] mt-0.5 leading-relaxed">
              When viewing in AI Studio Build, the app runs inside an iframe. To install the pure GQueues app (with its own icon and name), download the APK file directly to your <strong>Downloads</strong> folder below, or open the <strong>Direct Standalone App</strong>!
            </p>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'android'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>Android (APK File)</span>
          </button>

          <button
            onClick={() => setActiveTab('windows')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'windows'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-600" />
            <span>Windows (Installer)</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'ios'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Apple className="w-4 h-4 text-slate-800" />
            <span>iOS (iPhone/iPad)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-700">
          {/* Android Tab */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              {/* Primary: Direct Download APK to Downloads Folder */}
              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <FileBox className="w-5 h-5 text-emerald-700" />
                  <h4 className="font-bold text-emerald-950 text-sm">Download APK to Downloads Folder</h4>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed mb-3">
                  Click the button below to download <strong>GQueues-Workspace.apk</strong> directly to your device's <strong>Downloads</strong> folder. Once downloaded, tap the file in your notification bar or Downloads folder to install.
                </p>

                <a
                  href="/downloads/GQueues-Workspace.apk"
                  download="GQueues-Workspace.apk"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer no-underline"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download GQueues-Workspace.apk</span>
                </a>

                {/* 3 Steps to Install the APK */}
                <div className="mt-3 pt-3 border-t border-emerald-200/80 space-y-1.5 text-xs text-emerald-950">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-emerald-800 block">
                    How to install the downloaded APK:
                  </span>
                  <div className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                    <span>Tap <strong>Download GQueues-Workspace.apk</strong> above. The file saves to your phone's <strong>Downloads</strong> folder.</span>
                  </div>
                  <div className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                    <span>Pull down your notification shade or open your <strong>Files / Downloads</strong> app, then tap <strong>GQueues-Workspace.apk</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                    <span>Tap <strong>Install</strong>. If prompted with "Install unknown apps", toggle <strong>Allow from this source</strong> to proceed.</span>
                  </div>
                </div>
              </div>

              {/* Secondary Option: Direct Standalone WebAPK */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  Or Open Standalone App on Android Chrome (WebAPK):
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Opening the app outside Google AI Studio allows Chrome on your phone to automatically install the standalone GQueues app with its own native launcher icon:
                </p>
                <div className="flex gap-2">
                  <a
                    href={standaloneAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors no-underline text-center"
                  >
                    <span>Open Standalone App</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleCopyLink}
                    className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied URL!' : 'Copy URL'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Windows Tab */}
          {activeTab === 'windows' && (
            <div className="space-y-4">
              {/* Download Windows Installer to Downloads folder */}
              <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <Monitor className="w-5 h-5 text-blue-700" />
                  <h4 className="font-bold text-blue-950 text-sm">Download Windows App Installer (.bat)</h4>
                </div>
                <p className="text-xs text-blue-900 leading-relaxed mb-3">
                  Downloads <strong>Install-GQueues-Windows.bat</strong> to your <strong>Downloads</strong> folder. Running it creates a standalone Desktop & Start Menu shortcut for GQueues Workspace.
                </p>

                <a
                  href="/downloads/Install-GQueues-Windows.bat"
                  download="Install-GQueues-Windows.bat"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer no-underline"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download Windows App Installer</span>
                </a>
              </div>

              {/* Or Direct Chrome / Edge App Install */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-semibold text-slate-800 text-xs">
                  Or Open in Standalone Tab in Chrome / Edge:
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Open the standalone tab, then click the <strong>Install</strong> icon in the address bar. This creates a pure GQueues desktop window without the Google Studio frame:
                </p>
                <div className="flex gap-2">
                  <a
                    href={standaloneAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors no-underline text-center"
                  >
                    <span>Open Standalone Tab in Browser</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* iOS Tab */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900 text-xs">Direct Link for iPhone / iPad Safari</p>
                <p className="text-slate-600 text-[11px] mt-1 mb-2">
                  Open this link directly in Safari to add the standalone app to your home screen:
                </p>
                <div className="flex gap-2">
                  <a
                    href={standaloneAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors no-underline text-center"
                  >
                    <span>Open in Safari</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleCopyLink}
                    className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-3 p-2.5 bg-blue-50/60 rounded-xl border border-blue-200">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">In Safari, tap the Share button</p>
                    <p className="text-slate-600 text-[11px]">
                      Tap <Share2 className="w-3 h-3 inline mx-0.5 text-blue-600" /> in the bottom toolbar.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 bg-blue-50/60 rounded-xl border border-blue-200">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Tap "Add to Home Screen"</p>
                    <p className="text-slate-600 text-[11px]">
                      Scroll down and tap <PlusSquare className="w-3 h-3 inline mx-0.5 text-slate-700" /> Add to Home Screen.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 bg-blue-50/60 rounded-xl border border-blue-200">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Tap "Add" in Top Right</p>
                    <p className="text-slate-600 text-[11px]">
                      GQueues will appear on your iOS home screen as its own standalone app.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Direct Downloads to Downloads Folder</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
