import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X, Check, ZoomIn } from "lucide-react";

interface LobbyCardCropperProps {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
}

// 名片显示比例 4:7（与主页名片 aspect-[4/7] 一致）
const FRAME_W = 280;
const FRAME_H = 490;
const OUT_W = 800;
const OUT_H = 1400;

const LobbyCardCropper = ({ file, onCancel, onConfirm }: LobbyCardCropperProps) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const coverScale = imgSize ? Math.max(FRAME_W / imgSize.w, FRAME_H / imgSize.h) : 1;
  const scale = coverScale * zoom;
  const dispW = imgSize ? imgSize.w * scale : 0;
  const dispH = imgSize ? imgSize.h * scale : 0;

  const clamp = useCallback((x: number, y: number, dw: number, dh: number) => ({
    x: Math.min(0, Math.max(FRAME_W - dw, x)),
    y: Math.min(0, Math.max(FRAME_H - dh, y)),
  }), []);

  // 缩放变化时重新夹取偏移，保证图片始终铺满框
  useEffect(() => {
    setOffset((o) => clamp(o.x, o.y, dispW, dispH));
  }, [zoom, dispW, dispH, clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clamp(d.baseX + e.clientX - d.startX, d.baseY + e.clientY - d.startY, dispW, dispH));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleConfirm = async () => {
    if (!imgSize || !imgUrl) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = imgUrl;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = FRAME_W / scale;
      const sh = FRAME_H / scale;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      if (!blob) throw new Error("导出图片失败");
      await onConfirm(blob);
    } catch (e) {
      console.error("crop export failed:", e);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="val-cut border border-border/60 bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-tactical text-lg font-bold uppercase tracking-widest">裁剪名片图片</h3>
          <button onClick={onCancel} className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative touch-none select-none overflow-hidden border border-primary/40"
          style={{ width: FRAME_W, height: FRAME_H }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {imgUrl && imgSize && (
            <img
              src={imgUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none"
              style={{ width: dispW, height: dispH, transform: `translate(${offset.x}px, ${offset.y}px)` }}
            />
          )}
          {/* 四角红色取景框装饰 */}
          <div className="pointer-events-none absolute left-1 top-1 h-4 w-4 border-l-2 border-t-2 border-primary" />
          <div className="pointer-events-none absolute right-1 top-1 h-4 w-4 border-r-2 border-t-2 border-primary" />
          <div className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 border-b-2 border-l-2 border-primary" />
          <div className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 border-b-2 border-r-2 border-primary" />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">拖动图片调整位置，滑块缩放，红框内即为名片显示区域</p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="val-cut-sm flex-1 border border-border/60 py-2 font-tactical text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || !imgSize}
            className="val-cut-sm flex flex-1 items-center justify-center gap-1.5 bg-primary py-2 font-tactical text-sm font-bold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            确认上传
          </button>
        </div>
      </div>
    </div>
  );
};

export default LobbyCardCropper;
