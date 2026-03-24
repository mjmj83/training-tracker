import { useSelectedClient } from "@/lib/state";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell } from "lucide-react";
import AbcCalculator from "@/components/abc-calculator";
import type { Client } from "@shared/schema";

export default function AbcPage() {
  const { clientId } = useSelectedClient();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const client = clients.find(c => c.id === clientId);

  if (!clientId || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Dumbbell className="w-10 h-10 opacity-30" />
        <p className="text-sm">Selecteer een klant in de zijbalk</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-lg font-semibold mb-1">Vetpercentage</h1>
      <p className="text-xs text-muted-foreground mb-6">
        US Army Body Composition (AR 600-9) — schat het vetpercentage op basis van omtrekmetingen.
      </p>
      <AbcCalculator clientId={clientId} clientGender={client.gender as "male" | "female"} />
    </div>
  );
}
