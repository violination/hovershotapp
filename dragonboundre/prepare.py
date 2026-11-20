"""Private test adapter for DragonBoundRE upstream; never repackage personal SQL data."""
from pathlib import Path
import re

root=Path("/opt/dragonbound")
source=root/"database/dragonbound.sql"
raw=source.read_text(encoding="utf-8-sig",errors="replace")
# Keep DDL and strictly selected runtime configuration fixtures. Do not import any
# pre-existing accounts, payments, chat, sessions, avatars or user-generated data.
approved={"event_game","info_tournament"}
names=[]
deleted={}
def scrub(match):
    name=match.group(2).lower()
    names.append(name)
    if name in approved:
        return match.group(0)
    deleted[name]=deleted.get(name,0)+1
    return ""
# Standard mysql / phpMyAdmin dump INSERT/REPLACE statements with optional newlines.
pattern=re.compile(r"(?ims)^((?:INSERT|REPLACE)\s+INTO)\s+`?([A-Za-z0-9_]+)`?\b[^;]*;[ \t]*(?:\r?\n)?")
clean=pattern.sub(scrub,raw)
# Do not leave any account data if the dump used a non-standard variant.
if re.search(r"(?im)^\s*(INSERT|REPLACE)\s+INTO\s+`?(accounts|users|account_sessions|payments|chat|friends|banned)\b",clean):
    raise RuntimeError("Sensitive SQL INSERT was not removed")
clean=clean.replace("utf8mb4_0900_ai_ci","utf8mb4_unicode_ci")
(root/"database/seed-sanitized.sql").write_text(clean,encoding="utf-8")
source.unlink()  # remove original SQL from runtime image
print("SANITIZED_SQL_OK statements_removed="+str(sum(deleted.values()))+" approved_fixtures="+str(len(names)-sum(deleted.values())))

# Render publishes a single HTTPS port. Intercept the old game WS URLs and
# forward them via nginx /game/<world>. Keep the original gameplay code untouched.
view=root/"src/web/views/index.handlebars"
html=view.read_text(encoding="utf-8-sig")
shim="""<script>
(function(){
  const OriginalWebSocket=window.WebSocket;
  if(!OriginalWebSocket)return;
  function RedirectedWebSocket(url,protocols){
    let target=url;
    try{
      const addr=new URL(String(url),window.location.href);
      if(addr.port==='9001'||/dragonbound|thorbound|classicbound|dangerbound/i.test(addr.hostname)){
        const path=addr.pathname==='/'?'/1':addr.pathname;
        target=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/game'+path+addr.search;
      }
    }catch(e){}
    return protocols===undefined?new OriginalWebSocket(target):new OriginalWebSocket(target,protocols);
  }
  Object.setPrototypeOf(RedirectedWebSocket,OriginalWebSocket);
  RedirectedWebSocket.prototype=OriginalWebSocket.prototype;
  window.WebSocket=RedirectedWebSocket;
})();
</script>"""
if "<head>" not in html:
    raise RuntimeError("Expected original game head not found")
view.write_text(html.replace("<head>","<head>\n"+shim,1),encoding="utf-8")
app=root/"src/web/main/config/app.js"
code=app.read_text()
if "const app = express();" not in code:raise RuntimeError("Cannot configure Express trust proxy")
app.write_text(code.replace("const app = express();","const app = express();\n  app.set('trust proxy', 1);",1))
print("DRAGONBOUNDRE_ADAPTER_READY")
