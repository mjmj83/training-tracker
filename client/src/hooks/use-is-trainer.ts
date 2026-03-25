import { useAuth } from "@/lib/auth";

export function useIsTrainer() {
  const { user } = useAuth();
  return user?.role === "trainer";
}
