import { trpc } from "@/lib/trpc";

export function usePasswordGate() {
  const utils = trpc.useUtils();
  const statusQuery = trpc.passwordGate.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const unlockMutation = trpc.passwordGate.unlock.useMutation({
    onSuccess: () => utils.passwordGate.status.invalidate(),
  });
  const lockMutation = trpc.passwordGate.lock.useMutation({
    onSuccess: () => utils.passwordGate.status.invalidate(),
  });
  const changePasswordMutation = trpc.passwordGate.changePassword.useMutation();

  return {
    loading: statusQuery.isLoading,
    unlocked: statusQuery.data?.unlocked ?? false,
    unlock: unlockMutation.mutateAsync,
    unlocking: unlockMutation.isPending,
    lock: lockMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    changingPassword: changePasswordMutation.isPending,
  };
}
