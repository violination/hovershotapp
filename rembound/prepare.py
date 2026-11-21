"""Lab-only adapter: use same Render origin for Next.js and local SpacetimeDB."""
from pathlib import Path
p=Path("/opt/rembound/src/features/game/spacetime/config.ts")
s=p.read_text(encoding="utf-8")
needle="""  const target = resolveSpacetimeTarget();
  const host ="""
replacement="""  // Use same-origin WSS for this isolated laboratory, never upstream accounts.
  if (typeof window !== 'undefined') {
    return (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
  }

  const target = resolveSpacetimeTarget();
  const host ="""
if s.count(needle)!=1:
    raise RuntimeError("Upstream SpacetimeDB URI configuration changed")
p.write_text(s.replace(needle,replacement),encoding="utf-8")
print("REMBOUND_SAME_ORIGIN_WSS_CONFIGURED")

# Upstream revision contains duplicated KeyA keyup clause causing EOF syntax error.
keyboard=Path("/opt/rembound/src/features/game/hooks/use-input.ts")
code=keyboard.read_text(encoding="utf-8")
broken="""    if (event.code === "KeyA") {
      event.preventDefault();
    if (event.code === "KeyA") {
      event.preventDefault();"""
repaired="""    if (event.code === "KeyA") {
      event.preventDefault();"""
if code.count(broken)!=1:
    raise RuntimeError("Upstream keyboard syntax issue changed; manual audit needed")
keyboard.write_text(code.replace(broken,repaired),encoding="utf-8")
print("REMBOUND_UPSTREAM_INPUT_SYNTAX_FIXED")

# SpacetimeAuth is an optional external OIDC integration and is NOT
# configured for this private lab. Hide the developer env-var placeholder;
# keep the supported local username/password flow intact.
auth=Path("/opt/rembound/src/features/auth/components/auth-window.tsx")
body=auth.read_text(encoding="utf-8")
old="""          <div className="gba-divider-row">
            <span className="gba-divider-line" />
            <span className="gba-divider-text">OR USE SPACETIMEAUTH</span>
            <span className="gba-divider-line" />
          </div>

          {spacetimeAuthConfigured ? (
            <SpacetimeAuthButtons
              onAuthed={onAuthed}
              onError={(message) => setError(message)}
            />
          ) : (
            <div className="gba-auth-config-missing">
              SET NEXT_PUBLIC_SPACETIME_AUTH_CLIENT_ID
            </div>
          )}"""
new="""          {spacetimeAuthConfigured ? (
            <>
              <div className="gba-divider-row">
                <span className="gba-divider-line" />
                <span className="gba-divider-text">OR USE SPACETIMEAUTH</span>
                <span className="gba-divider-line" />
              </div>
              <SpacetimeAuthButtons
                onAuthed={onAuthed}
                onError={(message) => setError(message)}
              />
            </>
          ) : null}"""
if body.count(old)!=1:
    raise RuntimeError("Optional auth placeholder unexpectedly changed")
auth.write_text(body.replace(old,new),encoding="utf-8")
print("REMBOUND_OPTIONAL_OIDC_PLACEHOLDER_HIDDEN")
