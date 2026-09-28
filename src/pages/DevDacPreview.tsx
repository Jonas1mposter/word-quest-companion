import DacBadge from "@/components/battle/DacBadge";

const DevDacPreview = () => (
  <div className="min-h-screen bg-background p-4">
    <div className="max-w-4xl mx-auto text-muted-foreground text-sm">
      模拟对局画面（临时预览页）
    </div>
    <DacBadge />
  </div>
);

export default DevDacPreview;
