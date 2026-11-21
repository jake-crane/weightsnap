"use client";

import { signOutUser } from "@/app/dashboard/actions";
import { useOfflineState } from "@/components/offline-provider";
import { PAGE_CACHE } from "@/lib/offline-cache";

export function SignOutButton() {
  const { online } = useOfflineState();

  return (
    <form
      action={async () => {
        // The offline copy of the dashboard holds this account's data.
        if ("caches" in window) await caches.delete(PAGE_CACHE).catch(() => false);
        await signOutUser();
      }}
    >
      <button
        type="submit"
        disabled={!online}
        title={online ? undefined : "Connect to the internet to sign out"}
        className="cursor-pointer text-xs disabled:cursor-not-allowed disabled:opacity-40"
        style={{ color: "var(--text-muted)" }}
      >
        Sign out
      </button>
    </form>
  );
}
