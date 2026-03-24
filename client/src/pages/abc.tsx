import { useSelectedClient } from "@/lib/state";
import { Dumbbell } from "lucide-react";
import AbcCalculator from "@/components/abc-calculator";

export default function AbcPage() {
  const { clientId } = useSelectedClient();

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Dumbbell className="w-10 h-10 opacity-30" />
        <p className="text-sm">Selecteer een klant in de zijbalk</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-lg font-semibold mb-1">ABC Calculator</h1>
      <p className="text-xs text-muted-foreground mb-6">
        US Army Body Composition — schat het vetpercentage op basis van gewicht en buikomtrek.
      </p>
      <AbcCalculator clientId={clientId} />
    </div>
  );
}
