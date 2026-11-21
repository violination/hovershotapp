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

# The original eagerly decodes almost 50 PNG maps at startup and converts
# raw RGBA buffers into JS number arrays for every battle. On Render Free this
# exhausts 512 MiB before the website becomes playable. Decode terrain maps
# lazily, keep at most two templates, and clone compact pixel buffers on demand.
controller=root/"src/game/lib/mapController.js"
original=controller.read_text(encoding="utf-8")
if "if (load) {" not in original or "    getMap: function (id) {" not in original or not original.rstrip().endswith("});"):
    raise RuntimeError("Upstream mapController layout changed; refuse unsafe patch")
original=original.replace("if (load) {","if (false) {",1)
idx=original.index("    getMap: function (id) {")
replacement="""    getMap: function (id) {
        const fs=require('fs');
        const PNG=require('pngjs').PNG;
        id=Number(id);
        if (!Number.isInteger(id)||id<0||id>56)return null;
        try {
            var base=this.maps[id];
            if(!base) {
                const decoded=PNG.sync.read(fs.readFileSync(__dirname+'/maps/map'+id+'.png'));
                base=new Map(id);
                base.w=decoded.width;
                base.h=decoded.height;
                base.data=decoded.data;
                base.LoadPoints();
                this.maps[id]=base;
                while(Object.keys(this.maps).length>2) {
                    const oldest=Object.keys(this.maps)[0];
                    if(oldest===String(id))break;
                    delete this.maps[oldest];
                }
            }
            const instance=new Map(id);
            instance.data=Buffer.from(base.data);
            instance.w=base.w;
            instance.h=base.h;
            instance.points=base.points.map(p=>({...p}));
            return instance;
        } catch(error) {
            Logger.error('Map Error: '+id+' '+error.message);
            return null;
        }
    }
});
"""
controller.write_text(original[:idx]+replacement,encoding="utf-8")
print("DRAGONBOUNDRE_LAZY_TERRAIN_ENABLED cache=2 clone=Buffer")

# Original legacy module accidentally overwrites the JavaScript global Map
# constructor. When web and game share a Node process this makes rfdc/log4js
# fail with "constructorHandlers.set is not a function". It is not used as a
# module-scoped identifier after declaration, so export only the class.
legacy_map=root/"src/game/lib/map.js"
legacy_map_code=legacy_map.read_text(encoding="utf-8")
old_export="module.exports = Map = cls.Class.extend({"
if legacy_map_code.count(old_export)!=1:
    raise RuntimeError("Legacy global Map assignment changed")
legacy_map.write_text(legacy_map_code.replace(old_export,"module.exports = cls.Class.extend({",1),encoding="utf-8")
print("DRAGONBOUNDRE_GLOBAL_MAP_RESTORED")

# The Render router must NEVER detect/publish the unprotected upstream
# ports. Force both legacy processes to bind only on loopback. nginx 10000
# remains the sole externally reachable HTTP/WSS listener.
web_http=root/"src/web/main/config/httpServer.js"
web_http_code=web_http.read_text(encoding="utf-8")
if web_http_code.count("http.listen(config.PORT);")!=1:
    raise RuntimeError("Unknown web bind configuration")
web_http.write_text(web_http_code.replace("http.listen(config.PORT);","http.listen(config.PORT, '127.0.0.1');",1),encoding="utf-8")
game_http=root/"src/game/lib/ws.js"
game_http_code=game_http.read_text(encoding="utf-8")
if game_http_code.count("this._httpServer.listen(port, function()")!=1:
    raise RuntimeError("Unknown game bind configuration")
game_http.write_text(game_http_code.replace("this._httpServer.listen(port, function()","this._httpServer.listen(port, '127.0.0.1', function()",1),encoding="utf-8")
print("DRAGONBOUNDRE_LOOPBACK_ONLY web=8080 game=9001")




# --- Lab reconnection hardening (upstream adapter, no gameplay formula changes) ---
# Nginx on Render forwards all connections from 127.0.0.1. The legacy IP guard
# shared a permanent ban and an unbounded timestamp list between ALL players.
# Key that legacy guard by the socket's unique connection id, prune old actions,
# and delete it on close. This keeps rate limiting without banning other users.
game_main=root/"src/game.js"
game_source=game_main.read_text(encoding="utf-8")
old="const ip = connection._connection._socket.remoteAddress;"
if game_source.count(old)!=1:
    raise RuntimeError("Legacy IP guard in game.js changed")
game_source=game_source.replace(old,"const ip = connection.id;",1)
old="ip_actions[ip] = {baned:false,actions:[]};"
if game_source.count(old)!=1:
    raise RuntimeError("Legacy IP guard initialization changed")
game_source=game_source.replace(old,old+"\n            connection._connection.once('close', function(){ delete ip_actions[ip]; });",1)
game_main.write_text(game_source,encoding="utf-8")

account_source=root/"src/game/account.js"
acct=account_source.read_text(encoding="utf-8")
old="const ip = this.connection._connection._socket.remoteAddress;"
if acct.count(old)!=1:
    raise RuntimeError("Legacy action key in account.js changed")
acct=acct.replace(old,"const ip = this.con_id;",1)
old="    var instant_action = 0;\n    //console.log(ip);"
if acct.count(old)!=1:
    raise RuntimeError("Legacy anti-spam window changed")
acct=acct.replace(old,
"""    // Only count recent rapid room-create attempts for this connection.
    const guard = this.ip_actions[ip];
    if (guard) guard.actions = guard.actions.filter(t => Date.now() - t < 10000);
    var instant_action = 0;
    //console.log(ip);""",1)
account_source.write_text(acct,encoding="utf-8")
print("DRAGONBOUNDRE_PER_CONNECTION_RATE_LIMIT_ENABLED")

# Preserve idle browser WebSocket connections with server-origin ping/pong.
# The ping is handled by browsers automatically and also resets Nginx proxy
# upstream inactivity. Terminate dead peers to avoid accumulating stale rooms.
ws_file=root/"src/game/lib/ws.js"
wscode=ws_file.read_text(encoding="utf-8")
old="        this._wss.on('connection', function connection(ws,req) {\n"
if wscode.count(old)!=1:
    raise RuntimeError("WebSocket connection handler changed")
wscode=wscode.replace(old,old+"""            ws._labPong = true;
            ws.on('pong', function(){ ws._labPong = true; });
            ws.on('close', function(code){
                console.log('DRAGONBOUNDRE_WS_CLOSE code=' + code);
            });
""",1)
old="""            self.addConnection(c);
        });
    }"""
if wscode.count(old)!=1:
    raise RuntimeError("WebSocket constructor end changed")
wscode=wscode.replace(old,"""            self.addConnection(c);
        });
        this._labHeartbeat = setInterval(function(){
            self._wss.clients.forEach(function(peer){
                if (peer.readyState !== 1) return;
                if (peer._labPong === false) { peer.terminate(); return; }
                peer._labPong = false;
                try { peer.ping(); } catch (e) { peer.terminate(); }
            });
        },25000);
        this._labHeartbeat.unref();
    }""",1)
ws_file.write_text(wscode,encoding="utf-8")
print("DRAGONBOUNDRE_WS_KEEPALIVE_ENABLED interval=25s")
