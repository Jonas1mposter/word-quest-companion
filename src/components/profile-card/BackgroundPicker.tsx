import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Palette, Upload, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { backgroundOptions } from "./constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backgroundType: string;
  backgroundValue: string;
  uploading: boolean;
  onSelectGradient: (id: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveCustom: () => void;
}

export const BackgroundPicker = ({
  open, onOpenChange, backgroundType, backgroundValue,
  uploading, onSelectGradient, onUpload, onRemoveCustom,
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button className="absolute top-3 right-3 p-2 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/70 transition-all">
          <Palette className="w-4 h-4 text-foreground/70" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>自定义背景</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">上传图片</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={onUpload}
            className="hidden"
            disabled={uploading}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />上传中...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />选择图片</>
              )}
            </Button>
            {backgroundType === "image" && (
              <Button variant="destructive" size="icon" onClick={onRemoveCustom}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">支持 JPG、PNG、GIF、WebP，最大 5MB</p>
        </div>

        <div className="space-y-3 mt-4">
          <div className="text-sm font-medium text-muted-foreground">预设背景</div>
          <div className="grid grid-cols-2 gap-3">
            {backgroundOptions.map((bg) => (
              <button
                key={bg.id}
                className={cn(
                  "h-16 rounded-lg bg-gradient-to-br transition-all",
                  bg.gradient,
                  backgroundType === "gradient" && backgroundValue === bg.id
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "hover:opacity-80"
                )}
                onClick={() => onSelectGradient(bg.id)}
              >
                <span className="text-sm font-medium text-foreground/80 drop-shadow-md">{bg.name}</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
