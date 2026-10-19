import { useEffect, useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../firebase";
import { normalizeColombianPhone } from "../../shared/phone.js";

const PHONE_VERIFICATION_ENABLED =
  import.meta.env.VITE_PHONE_VERIFICATION_ENABLED === "true";

export default function PhoneVerification({ phone, onVerified }) {
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const recaptcha = useRef(null);
  const verifier = useRef(null);

  useEffect(() => () => {
    verifier.current?.clear();
    verifier.current = null;
  }, []);

  useEffect(() => {
    setConfirmation(null);
    setCode("");
    setVerifiedPhone("");
    setFeedback("");
    onVerified("");
    verifier.current?.clear();
    verifier.current = null;
  }, [phone, onVerified]);

  const normalizedPhone = normalizeColombianPhone(phone);

  const requestCode = async () => {
    if (!normalizedPhone) {
      setFeedback("Escribe un celular colombiano válido de 10 dígitos, que empiece por 3.");
      return;
    }
    setBusy(true);
    setFeedback("");
    try {
      verifier.current?.clear();
      verifier.current = new RecaptchaVerifier(auth, recaptcha.current, {
        size: "invisible",
      });
      const result = await signInWithPhoneNumber(auth, normalizedPhone, verifier.current);
      setConfirmation(result);
      setVerifiedPhone("");
      onVerified("");
      setFeedback("Código enviado por SMS. Escríbelo para verificar el teléfono.");
    } catch (error) {
      verifier.current?.clear();
      verifier.current = null;
      setFeedback(error?.code === "auth/too-many-requests"
        ? "Se hicieron demasiados intentos. Espera antes de volver a intentarlo."
        : "No pudimos enviar el código. Revisa el número y la configuración de verificación.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (event) => {
    event.preventDefault();
    if (!confirmation || !/^\d{6}$/.test(code)) {
      setFeedback("Escribe el código de 6 dígitos que recibiste.");
      return;
    }
    setBusy(true);
    setFeedback("");
    try {
      const result = await confirmation.confirm(code.trim());
      const confirmed = result.user.phoneNumber || "";
      if (confirmed !== normalizedPhone) {
        setVerifiedPhone("");
        onVerified("");
        setFeedback("El teléfono verificado no coincide con el número del formulario. Solicita un código nuevo.");
        return;
      }
      setVerifiedPhone(confirmed);
      onVerified(confirmed);
      setFeedback("Teléfono verificado correctamente.");
    } catch {
      setFeedback("El código no es válido o ha vencido. Compruébalo e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  if (!PHONE_VERIFICATION_ENABLED) {
    return (
      <div className="phone-verification phone-verification--disabled">
        <strong>Verificación telefónica pendiente de habilitación</strong>
        <p>El número se valida por formato, pero aún no se considera verificado. La verificación por SMS requiere habilitar el proveedor y revisar sus condiciones de facturación.</p>
      </div>
    );
  }

  return (
    <section className="phone-verification" aria-label="Verificación del teléfono">
      {verifiedPhone ? (
        <p className="phone-verification-success" role="status">✓ Teléfono verificado: {verifiedPhone}</p>
      ) : !confirmation ? (
        <>
          <p>Verifica que puedes recibir SMS en este número.</p>
          <button type="button" onClick={requestCode} disabled={busy || !normalizedPhone}>
            {busy ? "Enviando código…" : "Enviar código de verificación"}
          </button>
        </>
      ) : (
        <form onSubmit={confirmCode}>
          <label htmlFor="phone-verification-code">Código SMS de 6 dígitos</label>
          <input
            id="phone-verification-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
          <button type="submit" disabled={busy}>{busy ? "Verificando…" : "Confirmar código"}</button>
          <button type="button" className="phone-verification-secondary" onClick={requestCode} disabled={busy}>Enviar otro código</button>
        </form>
      )}
      <div ref={recaptcha} />
      {feedback && <p className="phone-verification-feedback" role="status">{feedback}</p>}
    </section>
  );
}
