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
