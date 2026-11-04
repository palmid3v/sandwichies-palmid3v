import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Link } from "react-router-dom";
import { auth } from "../firebase";
import CustomerAuth from "./CustomerAuth";
import {
  getCustomerProfile,
  saveCustomerProfile,
  listCustomerAddresses,
  saveCustomerAddress,
  deleteCustomerAddress,
} from "../api/customer-profile";
import "../styles/customer-profile.css";

const emptyAddress = {
  label: "Casa",
  recipientName: "",
  phone: "",
  line1: "",
  neighborhood: "",
  reference: "",
  city: "Medellín",
  department: "Antioquia",
  isDefault: false,
};

export default function CustomerProfile() {
  const [user, setUser] = useState(auth.currentUser);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState({ name: "", phone: "", preferences: { preferredFulfillment: "recoger", deliveryNotes: "" } });
  const [addresses, setAddresses] = useState([]);
  const [address, setAddress] = useState(emptyAddress);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (current) => {
    setUser(current);
    setReady(false);
    if (!current || current.isAnonymous || !current.emailVerified) return;
    try {
      const token = await current.getIdTokenResult(true);
      if (token.claims.email_verified !== true) return;
      const [profileResult, addressResult] = await Promise.all([
        getCustomerProfile(),
        listCustomerAddresses(),
      ]);
      setProfile(profileResult.profile);
      setAddresses(addressResult.addresses);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar tu perfil.");
    } finally {
      setReady(true);
    }
  }), []);

  if (!user || user.isAnonymous || !user.emailVerified) {
    return <CustomerAuth pendingMessage="Inicia sesión con tu correo verificado para administrar tu perfil." />;
  }

  const updatePreference = (key, value) => setProfile((current) => ({
    ...current,
    preferences: { ...current.preferences, [key]: value },
  }));

  const submitProfile = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await saveCustomerProfile(profile);
      setProfile(result.profile);
      setNotice("Perfil guardado.");
    } catch (saveError) {
      setError(saveError.message || "No fue posible guardar el perfil.");
    } finally {
      setBusy(false);
    }
  };

  const submitAddress = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await saveCustomerAddress({ ...address, ...(editingId ? { id: editingId } : {}) });
      setAddresses((current) => {
        const next = current.filter((item) => item.id !== result.address.id);
        return [...next, result.address].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      });
      setAddress(emptyAddress);
      setEditingId(null);
      setNotice("Dirección guardada.");
    } catch (saveError) {
      setError(saveError.message || "No fue posible guardar la dirección.");
    } finally {
      setBusy(false);
    }
  };

  const editAddress = (item) => {
    setEditingId(item.id);
    setAddress({
      label: item.label || "Casa",
      recipientName: item.recipientName || "",
      phone: item.phone || "",
      line1: item.line1 || "",
      neighborhood: item.neighborhood || "",
      reference: item.reference || "",
      city: item.city || "Medellín",
      department: item.department || "Antioquia",
      isDefault: item.isDefault === true,
    });
  };

  const removeAddress = async (id) => {
    setBusy(true);
    setError("");
    try {
      await deleteCustomerAddress(id);
      setAddresses((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setAddress(emptyAddress);
      }
      setNotice("Dirección eliminada.");
    } catch (removeError) {
      setError(removeError.message || "No fue posible eliminar la dirección.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    window.location.assign("/");
  };

  if (!ready) return <main className="customer-profile-page"><p role="status">Cargando perfil…</p></main>;

  return (
    <main className="customer-profile-page">
      <header className="customer-profile-header">
        <div><p className="admin-eyebrow">Cuenta de cliente</p><h1>Mi perfil</h1><p>{user.email}</p></div>
        <div className="customer-profile-actions"><Link to="/">Volver a la tienda</Link><button type="button" onClick={handleSignOut}>Cerrar sesión</button></div>
      </header>

      {error && <p className="customer-profile-message error" role="alert">{error}</p>}
      {notice && <p className="customer-profile-message" role="status">{notice}</p>}

      <form className="customer-profile-card" onSubmit={submitProfile}>
        <h2>Datos personales</h2>
        <div className="customer-profile-grid">
          <label>Nombre completo<input autoComplete="name" minLength={2} maxLength={80} required value={profile.name || ""} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>WhatsApp<input autoComplete="tel" inputMode="tel" required value={profile.phone || ""} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} placeholder="300 123 4567" /></label>
          <label>Correo electrónico<input value={profile.email || user.email || ""} readOnly /></label>
          <label>Entrega preferida<select value={profile.preferences?.preferredFulfillment || "recoger"} onChange={(event) => updatePreference("preferredFulfillment", event.target.value)}><option value="recoger">Recoger</option><option value="domicilio">Domicilio</option><option value="punto_encuentro">Punto de encuentro</option></select></label>
          <label className="customer-profile-wide">Indicaciones frecuentes<textarea maxLength={250} value={profile.preferences?.deliveryNotes || ""} onChange={(event) => updatePreference("deliveryNotes", event.target.value)} placeholder="Ej. llamar al llegar, portería..." /></label>
        </div>
        <button type="submit" disabled={busy}>Guardar perfil</button>
      </form>

      <section className="customer-profile-card">
        <h2>Mis direcciones</h2>
        <p className="customer-profile-muted">Puedes guardar hasta 10 direcciones. Solo tu cuenta puede consultarlas o modificarlas.</p>
        {addresses.map((item) => (
          <article className="customer-address-item" key={item.id}>
            <div><strong>{item.label}{item.isDefault ? " · Predeterminada" : ""}</strong><p>{item.line1}, {item.neighborhood}, {item.city}</p><small>{item.recipientName} · {item.phone}</small></div>
            <div><button type="button" onClick={() => editAddress(item)} disabled={busy}>Editar</button><button type="button" onClick={() => removeAddress(item.id)} disabled={busy}>Eliminar</button></div>
          </article>
        ))}
        <form className="customer-address-form" onSubmit={submitAddress}>
          <h3>{editingId ? "Editar dirección" : "Agregar dirección"}</h3>
          <div className="customer-profile-grid">
            <label>Nombre de la dirección<input maxLength={30} required value={address.label} onChange={(event) => setAddress((current) => ({ ...current, label: event.target.value }))} placeholder="Casa, trabajo..." /></label>
            <label>Destinatario<input maxLength={80} required value={address.recipientName} onChange={(event) => setAddress((current) => ({ ...current, recipientName: event.target.value }))} /></label>
            <label>WhatsApp<input maxLength={24} required value={address.phone} onChange={(event) => setAddress((current) => ({ ...current, phone: event.target.value }))} /></label>
            <label>Dirección<input maxLength={120} required value={address.line1} onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))} placeholder="Calle y número" /></label>
            <label>Barrio<input maxLength={60} required value={address.neighborhood} onChange={(event) => setAddress((current) => ({ ...current, neighborhood: event.target.value }))} /></label>
            <label>Ciudad<input maxLength={60} required value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} /></label>
            <label className="customer-profile-wide">Referencia<input maxLength={120} value={address.reference} onChange={(event) => setAddress((current) => ({ ...current, reference: event.target.value }))} placeholder="Apartamento, portería, indicaciones..." /></label>
            <label className="customer-profile-check"><input type="checkbox" checked={address.isDefault} onChange={(event) => setAddress((current) => ({ ...current, isDefault: event.target.checked }))} /> Usar como dirección predeterminada</label>
          </div>
          <div className="customer-profile-actions"><button type="submit" disabled={busy}>{editingId ? "Actualizar dirección" : "Guardar dirección"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setAddress(emptyAddress); }}>Cancelar edición</button>}</div>
        </form>
      </section>
    </main>
  );
}
