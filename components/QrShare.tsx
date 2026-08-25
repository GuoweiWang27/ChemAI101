import React, { useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, QrCode } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const QrShare: React.FC = () => {
  const { t } = useLanguage();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleQr = async () => {
    if (dataUrl) {
      setDataUrl(null);
      return;
    }
    const url = window.location.href;
    setDataUrl(await QRCode.toDataURL(url, { width: 220, margin: 1 }));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时忽略（二维码本身已可用）
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => void toggleQr()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium border border-science-300 text-science-700 hover:bg-science-50 transition-colors"
      >
        <QrCode className="w-4 h-4" /> {t('qrBtn')}
      </button>
      {dataUrl && (
        <div className="absolute right-0 top-full mt-2 z-20 bg-white rounded-xl shadow-xl border border-[#e8d5b8] p-4 w-[240px]">
          <img src={dataUrl} alt="QR" className="w-full rounded-lg" />
          <button
            onClick={() => void copyLink()}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#f0ece4] hover:bg-[#e8d5b8] text-sm font-medium text-[#5c5549]"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? t('linkCopied') : window.location.host + window.location.pathname}
          </button>
        </div>
      )}
    </div>
  );
};
