import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className="cursor-pointer text-xs" style={{ color: "var(--text-muted)" }}>
        Sign out
      </button>
    </form>
  );
}
