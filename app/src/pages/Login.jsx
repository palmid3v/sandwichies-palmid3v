import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { BUSINESS } from "../config/business";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setIsLoading(false);
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
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="motion-feedback" disabled={isLoading}>
          {isLoading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
