import { useSelectedClient } from "@/lib/state";
import { Dumbbell } from "lucide-react";
import ClientNotepad from "@/components/client-notepad";

export default function NotesPage() {
  const { clientId } = useSelectedClient();

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Dumbbell className="w-10 h-10 opacity-30" />
        <p className="text-sm">Selecteer een klant in de zijbalk</p>
      </div>
    );
  }

  return <ClientNotepad clientId={clientId} />;
}
