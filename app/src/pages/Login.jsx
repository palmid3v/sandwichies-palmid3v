import { useState } from "react";
import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { BUSINESS } from "../config/business";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setNotice("");
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setNotice("Tu correo aún no está verificado. Te enviamos un nuevo enlace; verifica tu bandeja de entrada.");
        return;
      }
    } catch (loginError) {
      setError(loginError?.code === "auth/too-many-requests"
        ? "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."
        : "No fue posible iniciar sesión. Verifica tus datos e inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setNotice("");
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
    <main className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <p className="admin-eyebrow">Acceso administrativo</p>
        <h1>{BUSINESS.name}</h1>
        <p>Gestiona pedidos, ventas e inventario.</p>
        <label>
          Correo
          <input type="email" autoComplete="email" required value={email}
            onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Contraseña
          <input type="password" autoComplete="current-password" required
            value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <div className="login-error" role="alert">{error}</div>}
        {notice && <div className="login-notice" role="status">{notice}</div>}
        <button type="button" className="text-button" onClick={handlePasswordReset}>
          Recuperar contraseña
        </button>
        <button type="submit" className="motion-feedback" disabled={isLoading}>
          {isLoading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
