import { LogoutButton } from './LogoutButton';

/** Sidebar footer: who is signed in, plus sign out. */
export function AccountCard({ name }: { name: string }) {
  return (
    <div className="account">
      <span className="avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      <span className="account-text">
        <span className="account-name">{name}</span>
        <span className="xs muted">Signed in</span>
      </span>
      <LogoutButton />
    </div>
  );
}
