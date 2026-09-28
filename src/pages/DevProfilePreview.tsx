import { PlayerProfileDialog } from "@/components/friends/PlayerProfileDialog";

export default function DevProfilePreview() {
  return (
    <div className="min-h-screen bg-background">
      <PlayerProfileDialog
        profileId="b2409a98-6719-4cab-a9fb-8b06e1a553a7"
        open={true}
        onOpenChange={() => {}}
      />
    </div>
  );
}
