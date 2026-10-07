import { auth } from "@clerk/nextjs/server";
import { Home } from "@/components/home";
import { Landing } from "@/components/landing";

/** Which enclosure colours have a render shipped in public/landing. */
const DESIGN_VARIANTS = ["green", "tan", "grey", "charcoal"];

/** Signed-in people land in the workspace; everyone else sees the landing page. */
export default async function Page() {
  const { userId } = await auth();
  return userId ? <Home /> : <Landing designVariants={DESIGN_VARIANTS} />;
}
