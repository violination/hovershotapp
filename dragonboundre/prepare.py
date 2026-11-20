"""DragonBoundRE upstream adapter: ingest schema while discarding unlicensed legacy user data."""
from pathlib import Path
import re

root=Path("/opt/dragonbound")
source=root/"database/dragonbound.sql"
raw=source.read_text(encoding="utf-8-sig",errors="replace")
allowed={"event_game","info_tournament"}
deleted={}
kept={}
def statements(text):
    """Split MySQL dump on unquoted semicolons, not newlines in INSERT values."""
    start=0
    i=0
    quote=None
    n=len(text)
    while i<n:
        ch=text[i]
        if quote is not None:
            if ch=="\\":
                i+=2;continue
            if ch==quote:
                if i+1<n and text[i+1]==quote:
                    i+=2;continue
                quote=None
        elif ch in ("'",'"',"`"):
            quote=ch
        elif ch=="#" or (ch=="-" and i+2<n and text[i:i+2]=="--" and text[i+2].isspace()):
            end=text.find("\n",i+1)
            i=n if end<0 else end
        elif ch=="/" and i+1<n and text[i+1]=="*":
            end=text.find("*/",i+2)
            i=n if end<0 else end+1
        elif ch==";":
            yield text[start:i+1]
            start=i+1
        i+=1
    if start<n:
        yield text[start:]

def main_sql(statement):
    # Strip comment headers before classifying the SQL command.
    text=re.sub(r"/\*.*?\*/","",statement,flags=re.S)
    text=re.sub(r"(?m)^[ \t]*(?:--[^\n]*|#[^\n]*)$","",text)
    return text.strip()

sql=[]
for statement in statements(raw):
    clean=main_sql(statement)
    match=re.match(r"(?is)^(?:INSERT|REPLACE)\s+(?:(?:LOW_PRIORITY|DELAYED|IGNORE)\s+)*INTO\s+[`\"]?([A-Za-z0-9_]+)",clean)
    if match:
        table=match.group(1).lower()
        if table not in allowed:
            deleted[table]=deleted.get(table,0)+1
            continue
        kept[table]=kept.get(table,0)+1
    sql.append(statement)
result="\n".join(sql).replace("utf8mb4_0900_ai_ci","utf8mb4_unicode_ci")
# Verification uses the same splitter: fail closed if any non-approved insert persists.
for statement in statements(result):
    match=re.match(r"(?is)^(?:INSERT|REPLACE)\s+INTO\s+[`\"]?([A-Za-z0-9_]+)",main_sql(statement))
    if match and match.group(1).lower() not in allowed:
        raise RuntimeError("Legacy data not fully sanitized")
(root/"database/seed-sanitized.sql").write_text(result,encoding="utf-8")
source.unlink()
print("SANITIZED_SQL_OK removed="+str(sum(deleted.values()))+" allowed="+str(kept))

# Redirect the legacy browser client's game WebSocket to the lab's HTTPS origin.
view=root/"src/web/views/index.handlebars"
html=view.read_text(encoding="utf-8-sig")
shim="""<script>
(function(){
  const OriginalWebSocket=window.WebSocket;
  if(!OriginalWebSocket)return;
  function RedirectedWebSocket(url,protocols){
    let target=url;
    try {
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
    raise RuntimeError("Expected legacy game head not found")
view.write_text(html.replace("<head>","<head>\n"+shim,1),encoding="utf-8")
app=root/"src/web/main/config/app.js"
code=app.read_text()
if "const app = express();" not in code:
    raise RuntimeError("Cannot configure Express proxy trust")
app.write_text(code.replace("const app = express();","const app = express();\n  app.set('trust proxy', 1);",1))
print("DRAGONBOUNDRE_ADAPTER_READY")
