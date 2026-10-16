"use client";

import { useState, type FormEvent } from "react";
import type { GroupDetail, GroupSummary, Me, Member } from "./types";
import { api } from "./api";
import { Avatar, Button, ConfirmDialog, Icon, Modal, SheetHeader } from "./ui";

function GroupAvatars({ members }: { members: Member[] }) {
  return (
    <span className="mini-pair">
      {members.slice(0, 3).map((m) => <Avatar key={m.id} name={m.name} color={m.color} small />)}
      {members.length > 3 && <span className="avatar avatar-small avatar-more">+{members.length - 3}</span>}
    </span>
  );
}

// Cambio rapido de sala (al tocar el nombre de la sala arriba). Las fijadas
// van primero; el pin se cambia desde aqui mismo.
export function GroupSwitcher({ groups, currentId, close, onSwitch, onPin, onCreate, onJoin }: {
  groups: GroupSummary[];
  currentId: string;
  close: () => void;
  onSwitch: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const pinned = groups.filter((g) => g.pinned);
  const others = groups.filter((g) => !g.pinned);
  const row = (g: GroupSummary) => (
    <div key={g.id} className={`group-row ${g.id === currentId ? "current" : ""}`}>
      <button className="group-row-main" onClick={() => onSwitch(g.id)}>
        <GroupAvatars members={g.members} />
        <span><strong>{g.name}</strong><small>{g.members.length} {g.members.length === 1 ? "persona" : "personas"}{g.admin ? " · admin" : ""}</small></span>
        {g.id === currentId && <Icon name="check" size={18} />}
      </button>
      <button className={`pin-button ${g.pinned ? "on" : ""}`} onClick={() => onPin(g.id, !g.pinned)} aria-label={g.pinned ? "Soltar sala" : "Fijar sala"} aria-pressed={g.pinned}>
        <Icon name="pin" size={16} />
      </button>
    </div>
  );
  return (
    <Modal close={close}>
      <SheetHeader eyebrow="TUS SALAS" title="Cambiar de sala" close={close} />
      {pinned.length > 0 && <span className="settings-label">FIJADAS</span>}
      <div className="group-list">{pinned.map(row)}</div>
      {others.length > 0 && pinned.length > 0 && <span className="settings-label">OTRAS</span>}
      <div className="group-list">{others.map(row)}</div>
      <p className="photos-hint" style={{ marginTop: 10 }}>Toca 📌 para fijar una sala arriba y cambiar más rápido.</p>
      <div className="group-actions">
        <Button variant="secondary" onClick={onCreate}><Icon name="plus" size={17} /> Crear sala</Button>
        <Button variant="ghost" onClick={onJoin}>Unirme con código</Button>
      </div>
    </Modal>
  );
}

export function CreateGroupForm({ onCreated, autoFocus = true }: { onCreated: (g: GroupSummary) => void; autoFocus?: boolean }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ group: GroupSummary }>("/api/groups", "POST", { name });
      onCreated(res.group);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="group-form">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Los del colegio, Familia, Nosotros 💜" maxLength={40} autoFocus={autoFocus} required />
      {error && <p className="form-error">{error}</p>}
      <Button type="submit" className="full" disabled={busy || !name.trim()}>{busy ? "Creando..." : "Crear sala"}</Button>
    </form>
  );
}

export function JoinGroupForm({ onJoined, initialCode = "", autoFocus = true }: { onJoined: (g: GroupSummary) => void; initialCode?: string; autoFocus?: boolean }) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ group: GroupSummary }>("/api/groups/join", "POST", { code });
      onJoined(res.group);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="group-form">
      <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={12} autoCapitalize="characters" autoComplete="off" autoFocus={autoFocus} required />
      {error && <p className="form-error">{error}</p>}
      <Button type="submit" className="full" disabled={busy || code.trim().length < 4}>{busy ? "Entrando..." : "Unirme"}</Button>
    </form>
  );
}

export function CreateGroupSheet({ close, onCreated }: { close: () => void; onCreated: (g: GroupSummary) => void }) {
  return (
    <Modal close={close}>
      <SheetHeader eyebrow="NUEVA SALA" title="Crear una sala" subtitle="Después invitas a los demás con un código o un enlace." close={close} />
      <CreateGroupForm onCreated={onCreated} />
    </Modal>
  );
}

export function JoinGroupSheet({ close, onJoined }: { close: () => void; onJoined: (g: GroupSummary) => void }) {
  return (
    <Modal close={close}>
      <SheetHeader eyebrow="UNIRME" title="Entrar a una sala" subtitle="Escribe el código que te compartieron." close={close} />
      <JoinGroupForm onJoined={onJoined} />
    </Modal>
  );
}

// Primera vez (o sin salas): crear una o unirse con un codigo.
export function Onboarding({ me, onReady, onLogout }: { me: Me; onReady: (g: GroupSummary) => void; onLogout: () => void }) {
  return (
    <div className="app-shell">
      <div className="mobile-app">
        <main className="page onboarding">
          <span className="eyebrow">BIENVENIDO</span>
          <h1>Hola, {me.name} 💜</h1>
          <p className="lead">Las salas son los grupos donde planean juntos: tu pareja, tus amigos, tu familia… Puedes estar en varias.</p>
          <section className="settings-section onboarding-card">
            <strong>✨ Crear una sala</strong>
            <small>Y luego invitas a los demás.</small>
            <CreateGroupForm onCreated={onReady} autoFocus={false} />
          </section>
          <section className="settings-section onboarding-card">
            <strong>🔑 Tengo un código</strong>
            <small>Si alguien ya te invitó.</small>
            <JoinGroupForm onJoined={onReady} autoFocus={false} />
          </section>
          <button className="destructive-link" onClick={onLogout}>Cerrar sesión</button>
        </main>
      </div>
    </div>
  );
}

export function inviteLink(code: string) {
  return `${window.location.origin}/unirme/${code}`;
}

// Codigo y enlace para invitar; los admins pueden cambiar el codigo.
export function InvitePanel({ group, onChanged }: { group: GroupDetail; onChanged: (g: GroupDetail) => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const link = inviteLink(group.code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setMsg("Enlace copiado ✓");
    } catch {
      setMsg(link);
    }
  }
  async function share() {
    try {
      await navigator.share({ title: group.name, text: `Únete a «${group.name}» en Plan de dos`, url: link });
    } catch {
      // se cancelo
    }
  }
  async function regenerate() {
    setBusy(true);
    try {
      const res = await api<{ group: GroupDetail }>(`/api/groups/${group.id}`, "PATCH", { regenerateCode: true });
      onChanged(res.group);
      setMsg("Código nuevo. El anterior ya no sirve.");
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="email-status">Comparte el código o el enlace. Quien lo tenga puede entrar a la sala.</p>
      <div className="invite-code" aria-label="Código de invitación">{group.code}</div>
      <div className="invite-actions">
        <Button variant="secondary" onClick={copy}><Icon name="note" size={16} /> Copiar enlace</Button>
        {typeof navigator !== "undefined" && "share" in navigator && <Button variant="secondary" onClick={share}><Icon name="sparkles" size={16} /> Compartir</Button>}
      </div>
      {msg && <p className="form-success" style={{ margin: "10px 0 0", wordBreak: "break-all" }}>{msg}</p>}
      {group.admin && (
        <button className="text-link" style={{ marginTop: 6 }} onClick={regenerate} disabled={busy}>Cambiar el código (el viejo deja de servir)</button>
      )}
    </>
  );
}

// Miembros de la sala; los admins pueden nombrar admins y sacar personas.
export function MembersPanel({ group, me, onChanged }: { group: GroupDetail; me: Me; onChanged: (members: Member[]) => void }) {
  const [confirm, setConfirm] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggleAdmin(m: Member) {
    setError("");
    try {
      const res = await api<{ members: Member[] }>(`/api/groups/${group.id}/members/${m.id}`, "PATCH", { admin: !m.admin });
      onChanged(res.members);
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function remove() {
    if (!confirm) return;
    setBusy(true);
    try {
      const res = await api<{ members: Member[] }>(`/api/groups/${group.id}/members/${confirm.id}`, "DELETE");
      onChanged(res.members);
      setConfirm(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="member-list">
        {group.members.map((m) => (
          <div key={m.id} className="member-row">
            <Avatar name={m.name} color={m.color} />
            <span><strong>{m.name}{m.id === me.id ? " (tú)" : ""}</strong>{m.admin && <small>Admin</small>}</span>
            {group.admin && m.id !== me.id && (
              <span className="member-actions">
                <button onClick={() => toggleAdmin(m)}>{m.admin ? "Quitar admin" : "Hacer admin"}</button>
                <button className="danger" onClick={() => setConfirm(m)}>Sacar</button>
              </span>
            )}
          </div>
        ))}
      </div>
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
      {confirm && (
        <ConfirmDialog
          title={`¿Sacar a ${confirm.name}?`}
          message="Deja de ver la sala. Puede volver a entrar solo si alguien le comparte el código."
          confirmLabel="Sacar"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

