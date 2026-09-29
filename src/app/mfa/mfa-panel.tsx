"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Alert, Button, Input } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface MfaPanelProps {
  nextPath: string;
}

export function MfaPanel({ nextPath }: MfaPanelProps) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    async function prepareMfa() {
      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.error) throw aal.error;

      if (aal.data.currentLevel === "aal2") {
        router.replace(nextPath);
        return;
      }

      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const verified = factors.data.totp.find((factor) => factor.status === "verified");
      if (verified) {
        if (active) {
          setFactorId(verified.id);
          setStatus("ready");
        }
        return;
      }

      for (const factor of factors.data.totp) {
        if (factor.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const enrollment = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Yas English Lab",
      });
      if (enrollment.error) throw enrollment.error;

      if (active) {
        setFactorId(enrollment.data.id);
        setQrCode(enrollment.data.totp.qr_code);
        setSecret(enrollment.data.totp.secret);
        setStatus("ready");
      }
    }

    prepareMfa().catch(() => {
      if (active) {
        setErrorMessage("Não foi possível preparar a verificação em duas etapas.");
        setStatus("error");
      }
    });

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || code.trim().length === 0) return;

    setErrorMessage(null);
    const supabase = getSupabaseBrowserClient();

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setErrorMessage("Não foi possível validar este código.");
      return;
    }

    const verification = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });

    if (verification.error) {
      setErrorMessage("Código inválido ou expirado.");
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  if (status === "loading") {
    return <Alert tone="info" title="Preparando MFA..." />;
  }

  if (status === "error") {
    return <Alert tone="error" title={errorMessage ?? "Erro ao preparar MFA"} />;
  }

  return (
    <form className="yas-stack" onSubmit={handleSubmit}>
      {qrCode && (
        <div className="yas-stack">
          {/* Supabase Auth provides this QR code as a data URL for TOTP enrollment. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="yas-mfa-qr" src={qrCode} alt="QR code para configurar o autenticador" />
          {secret && (
            <div>
              <p className="yas-profile-meta">Chave manual</p>
              <div className="yas-mfa-secret">{secret}</div>
            </div>
          )}
        </div>
      )}

      {errorMessage && <Alert tone="error" title={errorMessage} />}

      <Input
        label="Código do autenticador"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
      />
      <Button type="submit" variant="secondary">
        Verificar código
      </Button>
    </form>
  );
}
