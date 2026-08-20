import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePasswordGate } from "@/hooks/usePasswordGate";
import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";

export default function ChangePasswordDialog({ trigger }: { trigger: (openDialog: () => void) => React.ReactNode }) {
  const { changePassword, changingPassword } = usePasswordGate();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("เปลี่ยนรหัสผ่านแล้ว");
      setOpen(false);
      reset();
    } catch (caughtError) {
      setError(caughtError instanceof TRPCClientError ? caughtError.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ โปรดลองอีกครั้ง");
    }
  };

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) reset(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>เปลี่ยนรหัสผ่านเข้าแอป</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div>
            <Label htmlFor="current-password">รหัสผ่านปัจจุบัน</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="mt-2" />
          </div>
          <div>
            <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-2" />
          </div>
          <div>
            <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-2" />
          </div>
          {error && <p className="text-sm text-[#C2413E]">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={changingPassword} className="w-full rounded-xl bg-[#17342D] text-white hover:bg-[#26483F]">{changingPassword ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}
