import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card } from "@/components/ui";
import { fakeBillingAllowed } from "@/server/commercial/provider";
import { commercialStudent } from "@/server/commercial/checkout";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import styles from "@/modules/commercial/commercial.module.css";
export default async function FakeCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!fakeBillingAllowed()) notFound();
  const params = await searchParams;
  const id = z.uuid().safeParse(params.checkout);
  if (!id.success) notFound();
  const auth = await commercialStudent("/checkout");
  const { data, error } = await createSupabaseAdminClient()
    .from("billing_checkout_sessions")
    .select("id,plan_name")
    .eq("provider_checkout_id", id.data)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error || !data) notFound();
  return (
    <main className={styles.compact}>
      <Card>
        <div className="yas-stack">
          <h1>Checkout local de teste</h1>
          <p>Plano {data.plan_name}. Esta tela não confirma o pagamento.</p>
          <Link
            className="yas-button yas-button--secondary"
            href={`/billing/return?session=${data.id}&result=success`}
          >
            Retornar ao Yas
          </Link>
        </div>
      </Card>
    </main>
  );
}
