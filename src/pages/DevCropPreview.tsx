import { useEffect, useState } from "react";
import LobbyCardCropper from "@/components/dashboard/LobbyCardCropper";

// 临时验证页：生成测试图片并渲染名片裁剪器，确认后展示裁剪结果
const DevCropPreview = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 1200, 800);
    grad.addColorStop(0, "#1a2a4a");
    grad.addColorStop(1, "#ff4655");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 800);
    // 网格线便于观察裁剪区域
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    for (let x = 0; x <= 1200; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 800); ctx.stroke(); }
    for (let y = 0; y <= 800; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke(); }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 80px sans-serif";
    ctx.fillText("TEST 1200x800", 300, 420);
    canvas.toBlob((b) => {
      if (b) setFile(new File([b], "test.png", { type: "image/png" }));
    }, "image/png");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center gap-8 bg-background p-8">
      {file && !result && (
        <LobbyCardCropper
          file={file}
          onCancel={() => setFile(null)}
          onConfirm={async (blob) => {
            setResult(URL.createObjectURL(blob));
          }}
        />
      )}
      {result && (
        <div className="text-center">
          <p className="mb-2 font-tactical text-lg font-bold text-foreground">裁剪结果（800x1400）</p>
          <img src={result} alt="cropped" className="border border-primary" style={{ width: 280, height: 490 }} />
        </div>
      )}
    </div>
  );
};

export default DevCropPreview;
