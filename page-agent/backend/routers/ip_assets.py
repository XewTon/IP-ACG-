"""玄策 · IP 资产 / 角色运营 API（含 CRUD）"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from database import get_db

router = APIRouter(prefix="/api/ip", tags=["ip"])

# ─── 数据模型 ───
class CharacterCreate(BaseModel):
    name: str; role: str = ""; tag: str = ""; keywords: str = ""
    description: str = ""; assets: str = ""; commercial_value: str = ""
class CharacterUpdate(BaseModel):
    name: str | None = None; role: str | None = None; tag: str | None = None
    keywords: str | None = None; description: str | None = None
    assets: str | None = None; commercial_value: str | None = None

# ─── 当前演示IP（独立路由，避免与 /{ip_id} 冲突）───
current_ip_router = APIRouter(prefix="/api/current-ip", tags=["ip"])

@current_ip_router.get("/assets")
def get_current_ip():
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT id FROM ips ORDER BY id LIMIT 1")
    row = cur.fetchone()
    if not row: conn.close(); raise HTTPException(404, "No IP found — 请先运行 seed")
    ip_id = row["id"]
    conn.close()
    return get_ip_assets(ip_id)

# ─── IP列表 ───
@router.get("/list")
def list_ips():
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM ips ORDER BY id")
    rows = [dict(r) for r in cur.fetchall()]; conn.close()
    return {"data": rows}

# ─── 角色趋势 ───
@router.get("/characters/{character_id}/trend")
def character_trend(character_id: int, days: int = Query(default=30, ge=7, le=90)):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM characters WHERE id = ?", (character_id,))
    ch = cur.fetchone()
    if not ch: conn.close(); raise HTTPException(404, "Character not found")
    cur.execute("""SELECT date, search_index, discussions, fan_growth, fanworks, commercial_score
        FROM character_daily_metrics WHERE character_id = ? AND date >= date('now', ?) ORDER BY date""",
        (character_id, f"-{days} days"))
    trend = [dict(r) for r in cur.fetchall()]; conn.close()
    return {"character": dict(ch), "trend": trend}

class TrendPoint(BaseModel):
    date: str
    search_index: int = 0
    discussions: int = 0
    fan_growth: int = 0
    fanworks: int = 0
    commercial_score: float = 0

@router.post("/characters/{character_id}/trend")
def upsert_trend(character_id: int, body: TrendPoint):
    """新增/修改某一天的指标（按 character_id+date upsert，供「角色分析」编辑模式）"""
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT id FROM characters WHERE id=?", (character_id,))
    if not cur.fetchone(): conn.close(); raise HTTPException(404, "角色不存在")
    cur.execute("SELECT id FROM character_daily_metrics WHERE character_id=? AND date=?",
        (character_id, body.date))
    row = cur.fetchone()
    vals = (body.search_index, body.discussions, body.fan_growth, body.fanworks, body.commercial_score)
    if row:
        cur.execute(
            "UPDATE character_daily_metrics SET search_index=?,discussions=?,fan_growth=?,fanworks=?,commercial_score=? WHERE id=?",
            (*vals, row["id"]))
    else:
        cur.execute(
            "INSERT INTO character_daily_metrics (character_id,date,search_index,discussions,fan_growth,fanworks,commercial_score) VALUES (?,?,?,?,?,?,?)",
            (character_id, body.date, *vals))
    conn.commit(); conn.close()
    return {"message": "趋势点已保存"}

@router.delete("/characters/{character_id}/trend/{trend_date}")
def delete_trend(character_id: int, trend_date: str):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM character_daily_metrics WHERE character_id=? AND date=?", (character_id, trend_date))
    conn.commit(); conn.close()
    return {"message": "趋势点已删除"}

# ─── IP资产全量 ───
@router.get("/{ip_id}/assets")
def get_ip_assets(ip_id: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM ips WHERE id = ?", (ip_id,))
    ip = cur.fetchone()
    if not ip: conn.close(); raise HTTPException(404, "IP not found")
    cur.execute("SELECT * FROM characters WHERE ip_id = ? ORDER BY id", (ip_id,))
    characters = []
    for ch in cur.fetchall():
        cur.execute("SELECT version, date, description FROM character_versions WHERE character_id = ? ORDER BY id", (ch["id"],))
        characters.append({**dict(ch), "versions": [dict(v) for v in cur.fetchall()]})
    cur.execute("SELECT date_label, event, sort_order FROM lore_events WHERE ip_id = ? ORDER BY sort_order", (ip_id,))
    lore = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT category, content FROM ip_rules WHERE ip_id = ? ORDER BY id", (ip_id,))
    rules_raw = cur.fetchall()
    rules: dict[str, list[str]] = {}
    for r in rules_raw: rules.setdefault(r["category"], []).append(r["content"])
    conn.close()
    return {"ip": dict(ip), "characters": characters, "lore": lore, "rules": [{"category": k, "items": v} for k, v in rules.items()]}

# ─── 角色列表（含指标） ───
@router.get("/{ip_id}/characters")
def list_characters(ip_id: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""SELECT c.*, ROUND(AVG(m.search_index),0) AS search_index,
        ROUND(AVG(m.discussions),0) AS discussions, ROUND(AVG(m.fan_growth),0) AS fan_growth,
        ROUND(AVG(m.fanworks),0) AS fanworks, ROUND(AVG(m.commercial_score),1) AS commercial_avg
        FROM characters c LEFT JOIN character_daily_metrics m ON m.character_id=c.id AND m.date>=date('now','-7 days')
        WHERE c.ip_id=? GROUP BY c.id ORDER BY discussions DESC""", (ip_id,))
    rows = [dict(r) for r in cur.fetchall()]
    for row in rows:
        cur.execute("SELECT discussions FROM character_daily_metrics WHERE character_id=? ORDER BY date DESC LIMIT 30", (row["id"],))
        vals = [r["discussions"] for r in cur.fetchall()]
        if len(vals)>=15:
            recent=sum(vals[:15])/15; older=sum(vals[15:])/max(len(vals)-15,1)
            change=round((recent-older)/older*100,1) if older else 0
        else: change=0
        row["discussion_change_pct"]=change
    conn.close(); return {"data": rows}

# ─── 角色CRUD ───
@router.post("/{ip_id}/characters")
def create_character(ip_id: int, body: CharacterCreate):
    conn = get_db(); cur = conn.cursor()
    cur.execute("INSERT INTO characters (ip_id,name,role,tag,keywords,description,assets,commercial_value) VALUES (?,?,?,?,?,?,?,?)",
        (ip_id, body.name, body.role, body.tag, body.keywords, body.description, body.assets, body.commercial_value))
    cid = cur.lastrowid
    cur.execute("INSERT INTO character_versions (character_id,version,date,description) VALUES (?,?,date('now'),?)", (cid, "v1.0 初始设定", body.description or ""))
    conn.commit(); conn.close()
    return {"id": cid, "message": "角色已创建"}

@router.put("/characters/{character_id}")
def update_character(character_id: int, body: CharacterUpdate):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM characters WHERE id=?", (character_id,))
    if not cur.fetchone(): conn.close(); raise HTTPException(404, "角色不存在")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        cols = ", ".join(f"{k}=?" for k in updates)
        cur.execute(f"UPDATE characters SET {cols} WHERE id=?", (*updates.values(), character_id))
    conn.commit(); conn.close()
    return {"message": "角色已更新"}

@router.delete("/characters/{character_id}")
def delete_character(character_id: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM character_versions WHERE character_id=?", (character_id,))
    cur.execute("DELETE FROM character_daily_metrics WHERE character_id=?", (character_id,))
    cur.execute("DELETE FROM character_relations WHERE from_character_id=? OR to_character_id=?", (character_id, character_id))
    cur.execute("DELETE FROM characters WHERE id=?", (character_id,))
    conn.commit(); conn.close()
    return {"message": "角色已删除"}

# ─── 角色关系 ───
class RelationCreate(BaseModel):
    from_character_id: int
    to_character_id: int | None = None
    from_label: str = ""
    to_label: str = ""
    relation_type: str
    note: str = ""

@router.get("/{ip_id}/relations")
def character_relations(ip_id: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT id,name,tag FROM characters WHERE ip_id=?", (ip_id,))
    chars={r["id"]:dict(r) for r in cur.fetchall()}
    cur.execute("SELECT * FROM character_relations WHERE from_character_id IN (SELECT id FROM characters WHERE ip_id=?) OR to_character_id IN (SELECT id FROM characters WHERE ip_id=?)", (ip_id,ip_id))
    edges=[]; nodes={f"c{cid}":{"id":f"c{cid}","name":c["name"],"category":0} for cid,c in chars.items()}; org_idx=0
    for r in cur.fetchall():
        source=f"c{r['from_character_id']}" if r["from_character_id"] else None
        if r["to_character_id"]: target=f"c{r['to_character_id']}"
        else:
            label=r["to_label"] or "节点"; target=f"o{org_idx}"; org_idx+=1
            nodes[target]={"id":target,"name":label,"category":1 if "协会" in label or "市场" in label else 2}
        if not source: continue
        if source not in nodes and r["from_character_id"] in chars: nodes[source]={"id":source,"name":chars[r["from_character_id"]]["name"],"category":0}
        edges.append({"id":r["id"],"source":source,"target":target,"relation":r["relation_type"],"note":r["note"]})
    conn.close()
    return {"nodes":list(nodes.values()),"edges":edges,"categories":[{"name":"角色"},{"name":"组织/阵营"},{"name":"事件/地点"}]}

@router.post("/{ip_id}/relations")
def create_relation(ip_id: int, body: RelationCreate):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT id FROM characters WHERE id=?", (body.from_character_id,))
    if not cur.fetchone(): conn.close(); raise HTTPException(404, "源角色不存在")
    cur.execute("""INSERT INTO character_relations
        (from_character_id,to_character_id,from_label,to_label,relation_type,note)
        VALUES (?,?,?,?,?,?)""",
        (body.from_character_id, body.to_character_id, body.from_label, body.to_label, body.relation_type, body.note))
    rid = cur.lastrowid; conn.commit(); conn.close()
    return {"id": rid, "message": "关系已创建"}

@router.delete("/relations/{relation_id}")
def delete_relation(relation_id: int):
    conn = get_db(); cur = conn.cursor()
    cur.execute("DELETE FROM character_relations WHERE id=?", (relation_id,))
    conn.commit(); conn.close()
    return {"message": "关系已删除"}
