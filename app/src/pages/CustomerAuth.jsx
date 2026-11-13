import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";
import { BUSINESS } from "../config/business";
import { createOrLinkCustomerAccount } from "../auth/customer-account";

export default function CustomerAuth({ pendingMessage = "" }) {
  const [mode, setMode] = useState(() => auth.currentUser?.isAnonymous ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(pendingMessage);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pendingMessage) setNotice(pendingMessage);
  }, [pendingMessage]);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (user?.isAnonymous) setMode("register");
  }), []);

  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    clearMessages();
    try {
      if (mode === "register") {
        const linkedAnonymousSession = auth.currentUser?.isAnonymous === true;
        const credential = await createOrLinkCustomerAccount({
          auth,
          email,
          password,
          createAccount: createUserWithEmailAndPassword,
          linkAccount: linkWithCredential,
          createEmailCredential: EmailAuthProvider.credential,
        });
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setNotice(linkedAnonymousSession
          ? "Cuenta vinculada. Conservamos el mismo identificador de tu sesión anterior y sus datos; verifica tu correo y luego inicia sesión."
          : "Cuenta creada. Te enviamos un enlace de verificación; confirma tu correo y luego inicia sesión.");
        setMode("login");
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setNotice("Tu correo aún no está verificado. Te enviamos un nuevo enlace; verifica tu correo y vuelve a ingresar.");
      }
    } catch (authError) {
      if (auth.currentUser
        && auth.currentUser.isAnonymous !== true
        && auth.currentUser.emailVerified !== true) {
        await signOut(auth).catch(() => undefined);
      }
      const messages = {
        "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesión; por seguridad no fusionamos automáticamente dos cuentas distintas.",
        "auth/credential-already-in-use": "Ese correo ya pertenece a otra cuenta. Inicia sesión con esa cuenta; sus datos no se fusionan automáticamente con la sesión temporal.",
        "auth/invalid-email": "El correo no tiene un formato válido.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
        "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
        "auth/invalid-credential": "Correo o contraseña incorrectos.",
      };
      setError(messages[authError?.code] || "No fue posible completar la solicitud. Revisa tus datos e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    clearMessages();
    if (!email.trim()) {
      setError("Escribe tu correo para enviarte el enlace de recuperación.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice("Si existe una cuenta para ese correo, recibirás un enlace para restablecer la contraseña.");
    } catch {
      setError("No fue posible solicitar el restablecimiento. Revisa el correo e inténtalo de nuevo.");
    }
  };

  return (
    <main className="login-page customer-auth-page">
      <form className="login-card customer-auth-card" onSubmit={handleSubmit}>
        <p className="admin-eyebrow">Cuenta de cliente</p>
        <h1>{BUSINESS.name}</h1>
        <p>{mode === "register" ? "Crea tu cuenta para hacer y consultar tus pedidos." : "Inicia sesión para continuar con tu pedido."}</p>
        <label>
          Correo electrónico
          <input
            id="customer-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            id="customer-password"
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <div className="login-error" role="alert">{error}</div>}
        {notice && <div className="login-notice" role="status">{notice}</div>}
        {mode === "login" && (
          <button type="button" className="text-button" onClick={handlePasswordReset}>
            Recuperar contraseña
          </button>
        )}
        <button type="submit" className="motion-feedback" disabled={busy}>
          {busy ? "Procesando..." : mode === "register" ? "Crear cuenta" : "Ingresar"}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            clearMessages();
            setMode((current) => current === "register" ? "login" : "register");
          }}
        >
          {mode === "register" ? "Ya tengo una cuenta" : "Crear una cuenta nueva"}
        </button>
        <p className="customer-auth-footnote">El correo debe estar verificado para acceder a la tienda y realizar pedidos.</p>
      </form>
    </main>
  );
}
