import { SignIn } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";

export default function Page() {
  return (
    <AuthFrame>
      <SignIn />
    </AuthFrame>
  );
}
