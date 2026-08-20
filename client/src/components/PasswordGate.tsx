import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePasswordGate } from "@/hooks/usePasswordGate";
import { TRPCClientError } from "@trpc/client";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const { loading, unlocked, unlock, unlocking } = usePasswordGate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#F7F6F1]"><Skeleton className="h-52 w-80 rounded-3xl" /></div>;
  }

  if (unlocked) return <>{children}</>;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await unlock({ password });
    } catch (caughtError) {
      setError(caughtError instanceof TRPCClientError ? caughtError.message : "เข้าใช้งานไม่สำเร็จ โปรดลองอีกครั้ง");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#F7F6F1] px-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#E7E0D4] bg-white p-8 shadow-[0_14px_30px_rgba(32,54,45,0.08)]">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#D8B76A] text-[#17342D]"><LockKeyhole className="h-6 w-6" /></div>
        <h1 className="mt-5 font-serif text-2xl font-semibold text-[#17342D]">Portfolio Monitor</h1>
        <p className="mt-1 text-sm text-[#68736D]">ใส่รหัสผ่านเพื่อเข้าใช้งาน</p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div>
            <Label htmlFor="app-password">รหัสผ่าน</Label>
            <Input id="app-password" type="password" autoFocus value={password} onChange={event => setPassword(event.target.value)} className="mt-2 h-11 rounded-xl border-[#DED8CC]" />
          </div>
          {error && <p className="text-sm text-[#C2413E]">{error}</p>}
          <Button type="submit" disabled={unlocking || !password} className="h-11 rounded-xl bg-[#17342D] text-white hover:bg-[#26483F]">{unlocking ? "กำลังตรวจสอบ…" : "เข้าใช้งาน"}</Button>
        </form>
      </div>
    </div>
  );
}
