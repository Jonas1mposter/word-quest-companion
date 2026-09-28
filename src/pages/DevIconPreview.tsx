import { BadgeIcon } from "@/components/ui/badge-icon";

const names = ["Coins", "Mountain", "Megaphone", "Crown", "Target", "Trophy", "Flame", "Sprout"];

const DevIconPreview = () => (
  <div className="min-h-screen bg-background p-10 grid grid-cols-4 gap-6">
    {names.map((n) => (
      <div key={n} className="flex items-center gap-3 border border-border p-4">
        <BadgeIcon icon={n} className="h-8 w-8 text-primary" />
        <span className="text-sm text-foreground">{n}</span>
      </div>
    ))}
  </div>
);

export default DevIconPreview;
