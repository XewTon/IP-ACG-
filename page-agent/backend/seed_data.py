"""
预置《九歌/墨迹》演示 IP 运营数据 —— 玄策决策闭环种子。
"""
import json
from datetime import date, timedelta
from database import get_db, init_db


def seed():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    for table in [
        "metrics", "content", "competitors", "follower_history",
        "character_daily_metrics", "character_relations", "character_versions",
        "characters", "lore_events", "ip_rules", "activities", "sentiment_snapshots", "ips",
        "content_posts", "suppliers", "supply_tasks", "community_feedback", "community_events", "user_personas",
    ]:
        cursor.execute(f"DELETE FROM {table}")

    # ========== 粉丝历史 ==========
    follower_data = {
        "bilibili": [
            0, 0, 0, 0, 0, 0, 0, 0,
            800, 1500, 2400, 3200,
            3700, 4200, 4700, 5100,
            5600, 6400, 7300, 8400,
        ],
        "weibo": [
            0, 0, 0, 0, 0, 0, 0, 0,
            300, 500, 800, 1100,
            1500, 1900, 2400, 2800,
            3200, 3700, 4400, 5100,
        ],
        "xiaohongshu": [
            0, 0, 0, 0, 0, 0, 0, 0,
            150, 280, 420, 580,
            720, 880, 1080, 1350,
            1550, 1750, 2000, 2200,
        ],
        "wechat": [
            0, 0, 0, 0, 0, 0, 0, 0,
            180, 350, 530, 720,
            900, 1150, 1400, 1600,
            1900, 2300, 2750, 3150,
        ],
    }

    base_date = date.today() - timedelta(weeks=20)
    for platform, followers_list in follower_data.items():
        for week_idx, followers in enumerate(followers_list):
            d = base_date + timedelta(weeks=week_idx)
            cursor.execute(
                "INSERT INTO follower_history (date, platform, followers) VALUES (?, ?, ?)",
                (d.isoformat(), platform, followers),
            )

    today = date.today().isoformat()
    metrics = [
        ("bilibili", 8400, 48500, 2800, 5.8,
         json.dumps([
             {"title": "角色PV-林疏影", "views": 71300, "interactions": 8030},
             {"title": "角色PV-老白", "views": 68900, "interactions": 7690},
             {"title": "世界观解说#6", "views": 46100, "interactions": 4550},
         ], ensure_ascii=False)),
        ("weibo", 5100, 2200, 65, 3.0,
         json.dumps([
             {"title": "幕后花絮：沈砚线稿公开", "reads": 3800, "interactions": 120},
             {"title": "互动投票：你最喜欢哪个角色", "reads": 4200, "interactions": 210},
             {"title": "林疏影角色美学九宫格", "reads": 3100, "interactions": 95},
         ], ensure_ascii=False)),
        ("xiaohongshu", 2200, 1900, 420, 22.1,
         json.dumps([
             {"title": "东方幻想美到失语｜这部原创IP直接封神", "reads": 5200, "interactions": 2300},
             {"title": "如果你喜欢镖人，一定会爱《墨迹》", "reads": 3800, "interactions": 1500},
             {"title": "水墨风角色穿搭灵感｜沈砚篇", "reads": 2800, "interactions": 890},
         ], ensure_ascii=False)),
        ("wechat", 3150, 1200, 35, 0,
         json.dumps([
             {"title": "世界观测录#6：墨痕的七种形态", "reads": 1800, "interactions": 52},
             {"title": "运营手记：做《墨迹》这三个月", "reads": 1500, "interactions": 68},
             {"title": "角色深读：林疏影的旁观者视角", "reads": 1200, "interactions": 41},
         ], ensure_ascii=False)),
    ]
    for platform, followers, reads, interactions, rate, top in metrics:
        cursor.execute(
            """INSERT INTO metrics (platform, followers, reads_views, interactions, engagement_rate, top_content, recorded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (platform, followers, reads, interactions, rate, top, today),
        )

    contents = [
        ("bilibili", "先导PV", "视频", "2025-04-28 18:00", "2025-04-28 18:00", "published", 87200, 12620),
        ("bilibili", "世界观#1：墨客的起源", "视频", "2025-05-05 18:00", "2025-05-05 18:00", "published", 52300, 7950),
        ("bilibili", "世界观#2：墨痕的规则", "视频", "2025-05-12 18:00", "2025-05-12 18:00", "published", 38100, 5580),
        ("bilibili", "角色PV-沈砚", "视频", "2025-05-19 18:00", "2025-05-19 18:00", "published", 63500, 10550),
        ("bilibili", "世界观#4：疏影阁的秘密", "视频", "2025-06-02 18:00", "2025-06-02 18:00", "published", 44800, 6650),
        ("bilibili", "角色PV-林疏影", "视频", "2025-06-09 18:00", "2025-06-09 18:00", "published", 71300, 11680),
        ("bilibili", "世界观#6：墨客协会", "视频", "2025-06-23 18:00", "2025-06-23 18:00", "published", 46100, 6250),
        ("bilibili", "角色PV-老白", "视频", "2025-06-30 18:00", "2025-06-30 18:00", "published", 68900, 9690),
        ("weibo", "沈砚角色九宫格首发", "图文", "2025-04-28 10:00", "2025-04-28 10:00", "published", 4500, 180),
        ("weibo", "幕后花絮：废稿分享", "图文", "2025-05-10 21:00", "2025-05-10 21:00", "published", 3800, 145),
        ("weibo", "互动投票：下个角色PV选谁", "互动", "2025-06-05 12:30", "2025-06-05 12:30", "published", 4200, 210),
        ("xiaohongshu", "东方幻想美到失语｜这部原创IP直接封神", "笔记", "2025-05-02 12:00", "2025-05-02 12:00", "published", 5200, 2300),
        ("xiaohongshu", "终于有人在做年轻人的都市志怪了", "笔记", "2025-05-20 12:00", "2025-05-20 12:00", "published", 3800, 1500),
        ("wechat", "创刊号：世界观测录", "长文", "2025-04-28 21:00", "2025-04-28 21:00", "published", 2100, 72),
        ("wechat", "世界观测录#3：墨痕的七种形态", "长文", "2025-06-10 21:00", "2025-06-10 21:00", "published", 1800, 52),
        ("bilibili", "世界观#7：潘家园地下市场", "视频", "2025-07-07 18:00", None, "scheduled", 0, 0),
        ("weibo", "创作幕后：PV制作过程", "图文", "2025-07-05 10:00", None, "scheduled", 0, 0),
    ]
    for c in contents:
        cursor.execute(
            """INSERT INTO content (platform, title, content_type, scheduled_at, published_at, status, reads_views, interactions)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", c,
        )

    competitors = [
        ("bilibili", "某B-都市灵异", "comp_b_001", 82000, 45, 3200, "2025-07-01"),
        ("weibo", "某A-古风志怪", "comp_w_001", 120000, 180, 450, "2025-07-01"),
        ("xiaohongshu", "某C-赛博修仙", "comp_x_001", 51000, 95, 1200, "2025-07-01"),
    ]
    for comp in competitors:
        cursor.execute(
            """INSERT INTO competitors (platform, name, uid, followers, content_count, avg_engagement, last_updated)
               VALUES (?, ?, ?, ?, ?, ?, ?)""", comp,
        )

    # ========== IP ==========
    cursor.execute(
        """INSERT INTO ips (name, name_en, type, launch_date, target_users, commercial_score,
           heat_index, activity_index, sentiment_index, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            "九歌", "Jiuge / 墨迹", "原创国漫×都市志怪", "2025-04-28",
            "18-25岁，女性为主（65%），偏好东方美学与悬疑成长",
            91, 88, 76, 85,
            "东方幻想 × 神秘学 × 都市传说 × 年轻人成长。克制的东方美学，水墨笔触 + 现代都市质感。",
        ),
    )
    ip_id = cursor.lastrowid

    # ========== 角色 ==========
    chars = [
        ("沈砚", "大三历史系学生", "视角人物", "好奇心、迷茫、成长",
         "在图书馆古籍部第一次看见「墨痕」。代表发现世界另一面的普通人。", "立绘×3 / 表情集×1 / 角色卡×1", 82),
        ("林疏影", "古董店主 / 墨客记录者", "引路人", "疏离、优雅、沉静",
         "南锣鼓巷「疏影阁」老板。身处其中但选择旁观。", "立绘×3 / 场景概念×2 / 角色卡×1", 88),
        ("老白", "潘家园情报贩子", "灰色地带", "神秘、世故、亦正亦邪",
         "没人知道真名和年龄。不完全正派，但了解所有规则。", "立绘×2 / 角色卡×1", 75),
    ]
    char_ids = {}
    for name, role, tag, keywords, desc, assets, cv in chars:
        cursor.execute(
            """INSERT INTO characters (ip_id, name, role, tag, keywords, description, assets, commercial_value)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (ip_id, name, role, tag, keywords, desc, assets, cv),
        )
        char_ids[name] = cursor.lastrowid

    versions = {
        "沈砚": [
            ("v1.0 初始设定", "2025/03", "大学历史系学生，内向寡言，对古代文字有天赋"),
            ("v1.2 美术调整", "2025/05", "调整发型和服装配色，增加朱砂红发绳作为视觉锚点"),
            ("v1.5 剧情成长", "2025/07", "从被动发现墨痕到主动探索，眼神由迷茫转为坚定"),
        ],
        "林疏影": [
            ("v1.0 初始设定", "2025/03", "温婉知性的古董店老板，墨客协会资深成员"),
            ("v1.3 美术调整", "2025/06", "服装从旗袍改为改良汉服，增加暗金刺绣纹样"),
            ("v1.4 剧情成长", "2025/07", "揭示与沈砚父亲的往事，角色深度进一步展开"),
        ],
        "老白": [
            ("v1.0 初始设定", "2025/03", "潘家园旧货市场的神秘情报贩子"),
            ("v1.1 美术调整", "2025/05", "增加面部疤痕，强化沧桑感"),
        ],
    }
    for name, vers in versions.items():
        for v, d, desc in vers:
            cursor.execute(
                "INSERT INTO character_versions (character_id, version, date, description) VALUES (?, ?, ?, ?)",
                (char_ids[name], v, d, desc),
            )

    # 角色日指标（近30天）
    profiles = {
        "沈砚": {"search": 62, "disc": 420, "fan": 18, "fw": 12, "comm": 78, "growth": 1.012},
        "林疏影": {"search": 71, "disc": 580, "fan": 24, "fw": 22, "comm": 86, "growth": 1.018},
        "老白": {"search": 48, "disc": 310, "fan": 14, "fw": 8, "comm": 70, "growth": 1.025},
    }
    for day_offset in range(30, 0, -1):
        d = (date.today() - timedelta(days=day_offset)).isoformat()
        progress = (30 - day_offset) / 30
        for name, p in profiles.items():
            # 沈砚在近14天因新剧情讨论量抬升
            boost = 1.0
            if name == "沈砚" and day_offset <= 14:
                boost = 1.0 + (14 - day_offset) * 0.025
            if name == "老白" and day_offset <= 10:
                boost = 1.0 + (10 - day_offset) * 0.02
            search = int(p["search"] * (0.85 + 0.2 * progress) * boost)
            disc = int(p["disc"] * (0.8 + 0.35 * progress) * boost)
            fan = max(1, int(p["fan"] * (0.7 + 0.5 * progress) * boost))
            fw = max(0, int(p["fw"] * (0.75 + 0.4 * progress) * boost))
            comm = round(p["comm"] * (0.95 + 0.08 * progress) * min(boost, 1.08), 1)
            cursor.execute(
                """INSERT INTO character_daily_metrics
                   (character_id, date, search_index, discussions, fan_growth, fanworks, commercial_score)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (char_ids[name], d, search, disc, fan, fw, comm),
            )

    # 关系：角色 ↔ 角色 / 阵营 / 事件
    relations = [
        (char_ids["沈砚"], char_ids["林疏影"], "", "", "引路", "林疏影引导沈砚理解墨痕世界"),
        (char_ids["沈砚"], char_ids["老白"], "", "", "情报交易", "老白向沈砚出售半真半假的情报"),
        (char_ids["林疏影"], char_ids["老白"], "", "", "旧识", "早年在墨客圈子有过交集"),
        (char_ids["沈砚"], None, "", "墨客协会", "卷入", "普通人被迫卷入墨客体系"),
        (char_ids["林疏影"], None, "", "墨客协会", "从属", "资深记录者，选择旁观"),
        (char_ids["老白"], None, "", "潘家园地下市场", "盘踞", "灰色地带情报枢纽"),
        (char_ids["沈砚"], None, "", "古籍部墨痕事件", "触发", "故事开端：第一次看见墨痕"),
        (char_ids["林疏影"], None, "", "疏影阁", "据点", "南锣鼓巷古董店与记录之所"),
    ]
    for from_id, to_id, fl, tl, rtype, note in relations:
        cursor.execute(
            """INSERT INTO character_relations
               (from_character_id, to_character_id, from_label, to_label, relation_type, note)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (from_id, to_id, fl, tl, rtype, note),
        )

    lore = [
        (0, "远古", "墨痕首次出现——人类发现以墨为媒介感知世界真相的能力"),
        (1, "唐代", "墨客协会成立——记录者开始系统整理墨痕知识"),
        (2, "近代", "协会转入地下——科技兴起，墨客传统面临断层"),
        (3, "2025·春", "沈砚在古籍部发现第一道墨痕——故事开始"),
    ]
    for order, label, event in lore:
        cursor.execute(
            "INSERT INTO lore_events (ip_id, date_label, event, sort_order) VALUES (?, ?, ?, ?)",
            (ip_id, label, event, order),
        )

    rules = [
        ("视觉规范", "水墨笔触为主（晕染+留白），日系造型仅用于面部比例参考"),
        ("视觉规范", "黑白为主色调，朱砂红仅用于关键视觉焦点"),
        ("视觉规范", "外包参考图≤5张精确对标，禁止「广而全」"),
        ("文案风格", "沈砚：说话简短，从不使用语气词和网络用语"),
        ("文案风格", "林疏影：优雅克制，偶尔流露冷幽默"),
        ("文案风格", "老白：市井俚语+半真半假的调侃"),
        ("文案风格", "禁止卖萌/撒娇/热血/煽情语气"),
        ("禁用表达", "禁止「啊啊啊好帅」类粉丝站语气"),
        ("禁用表达", "禁止角色使用现代网络用语（yyds、绝绝子等）"),
        ("禁用表达", "禁止过度解释世界观设定（保持神秘感，留白）"),
        ("禁用表达", "禁止角色间CP拉踩或过度营业"),
    ]
    for cat, content in rules:
        cursor.execute(
            "INSERT INTO ip_rules (ip_id, category, content) VALUES (?, ?, ?)",
            (ip_id, cat, content),
        )

    activities = [
        ("沈砚角色PV上线周", "completed", "2025-05-19", "2025-05-25", "B站+微博", 63500, 8200, 4.2, 2.1, "角色成长线讨论升温"),
        ("林疏影美学企划", "completed", "2025-06-09", "2025-06-16", "B站+小红书", 71300, 9600, 5.1, 2.6, "商业潜力最高"),
        ("老白情报局互动周", "running", "2025-06-30", "2025-07-07", "B站+微博", 42000, 5100, 3.8, 1.7, "热度上升中"),
        ("沈砚生日限定企划", "planned", "2025-08-15", "2025-08-22", "全平台", 0, 0, 0, 0, "待AI助手生成方案"),
    ]
    for title, status, start, end, channel, exp, part, conv, roi, notes in activities:
        cursor.execute(
            """INSERT INTO activities
               (ip_id, title, status, start_date, end_date, channel, exposure, participants, conversion_rate, roi, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ip_id, title, status, start, end, channel, exp, part, conv, roi, notes),
        )

    cursor.execute(
        """INSERT INTO sentiment_snapshots
           (ip_id, date, positive, neutral, negative, keywords, risk_level, summary)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ip_id, today, 62, 28, 10,
            json.dumps(["角色成长", "水墨美学", "更新频率", "林疏影", "设定留白"], ensure_ascii=False),
            "low",
            "整体舆情健康。正面集中在角色成长线与美术；负面主要为更新节奏与少量设定歧义。",
        ),
    )

    # ========== 内容发布(Postiz) ==========
    content_posts = [
        ("bilibili", "int_bili_001", "世界观短片#8", "本期探索墨痕的七种形态与各自的历史起源", "2026-07-31T18:00:00", "draft", None, None, None),
        ("weibo", "int_weibo_001", "幕后花絮：线稿分享", "废稿也是好稿——分享一组沈砚立绘的未采用版本", "2026-07-29T12:30:00", "draft", None, None, None),
        ("xiaohongshu", "int_xhs_001", "东方幻想推荐笔记", "如果你喜欢镖人，一定会爱上九歌的水墨美学", "2026-07-30T12:00:00", "pending_review", None, None, None),
        ("bilibili", "int_bili_001", "角色PV-沈砚", "完整版沈砚角色PV，含动态水墨特效", "2026-07-25T18:00:00", "scheduled", None, None, f"postiz_{hash('shenyan')}"),
        ("wechat", "int_wx_001", "世界观测录：墨痕的七种形态", "深度解读墨痕体系的构建逻辑与创作幕后", "2026-07-30T21:00:00", "published", "运营负责人", "审核通过", f"postiz_{hash('worldview')}"),
        ("bilibili", "int_bili_001", "创作幕后vlog#2", "动画师的一天：从线稿到成片的制作流程", "2026-08-01T18:00:00", "draft", None, None, None),
    ]
    for platform, ch_id, title, body, sat, st, rn, rb, ppid in content_posts:
        cursor.execute(
            "INSERT INTO content_posts (platform,postiz_channel_id,title,body,scheduled_at,status,reviewer_note,reviewed_by,postiz_post_id) VALUES (?,?,?,?,?,?,?,?,?)",
            (platform, ch_id, title, body, sat, st, rn, rb, ppid),
        )

    # ========== 供应商 ==========
    suppliers = [
        ("星光漫画工作室", "漫画", "¥12K-18K/月", "按页计费", 90, 1.5, 4.5, "主笔1人+助理1人"),
        ("独立设计师·陈", "设计", "¥6K-8K/月", "月度承包", 95, 1.2, 4.8, "1人"),
        ("动画师·赵", "视频", "¥15K-25K/支", "按支计费", 70, 2.8, 3.5, "1人"),
    ]
    sup_ids = {}
    for name, cat, budget, mode, ot, rev, score, contact in suppliers:
        cursor.execute("INSERT INTO suppliers (name,category,budget,mode,on_time,revisions,score,contact) VALUES (?,?,?,?,?,?,?,?)",
            (name, cat, budget, mode, ot, rev, score, contact))
        sup_ids[name] = cursor.lastrowid

    supply_tasks = [
        (sup_ids["星光漫画工作室"], "角色立绘修改·林疏影终稿", "2026-07-30", "进行中", 0),
        (sup_ids["独立设计师·陈"], "社媒物料·第12周批量", "2026-07-31", "待验收", 0),
        (sup_ids["动画师·赵"], "先导PV·初版提交", "2026-07-25", "逾期", 3),
        (sup_ids["星光漫画工作室"], "漫画序章·分镜稿", "2026-08-05", "待派单", 0),
    ]
    for sid, task, deadline, status, overdue in supply_tasks:
        cursor.execute("INSERT INTO supply_tasks (supplier_id,task,deadline,status,overdue_days) VALUES (?,?,?,?,?)", (sid, task, deadline, status, overdue))

    # ========== 社区 ==========
    feedbacks = [
        ("B站", "墨***", "画风太绝了，水墨+都市第一次见", "positive", "美术党", "2026-07-25"),
        ("微博", "沈***", "终于有不做修仙的原创IP了", "positive", "剧情党", "2026-07-24"),
        ("B站", "白***", "老白这个角色太有味了求多戏份", "positive", "角色党", "2026-07-23"),
        ("B站", "新***", "世界观有点绕，看了两遍才明白", "neutral", "剧情党", "2026-07-22"),
        ("小红书", "画***", "能不能多发点沈砚的图啊", "neutral", "角色党", "2026-07-21"),
        ("公众号", "深***", "文章太硬核了能不能轻松一点", "negative", "剧情党", "2026-07-20"),
    ]
    for platform, uname, content, sentiment, role, dt in feedbacks:
        cursor.execute("INSERT INTO community_feedback (platform,user_name,content,sentiment,role_type,date) VALUES (?,?,?,?,?,?)", (platform, uname, content, sentiment, role, dt))

    events = [
        ("2026-07-28", "林疏影角色PV评论区集中讨论角色设计", "green", "正常互动，无需干预"),
        ("2026-07-22", "世界观#6视频下出现'设定太复杂'集中评论", "yellow", "关注中·已调整下一期视频叙述结构"),
        ("2026-07-15", "微博超话出现角色CP争论", "yellow", "已引导·不参与CP拉踩，发布官方角色关系说明"),
    ]
    for dt, title, level, action in events:
        cursor.execute("INSERT INTO community_events (date,title,level,action) VALUES (?,?,?,?)", (dt, title, level, action))

    personas = [
        ("剧情党", 38, "讨论剧情走向、分析世界观", "定期发布世界观测录、线索解密内容"),
        ("角色党", 32, "集中讨论某个角色，产出同人", "生日企划、专属内容、周边联动"),
        ("美术党", 18, "评论画风、求壁纸、临摹", "定期发高清原画、绘画教程、线稿分享"),
        ("收集党", 12, "关注周边、限量、预售", "提前通知衍生品信息、优先购买权"),
    ]
    for tp, pct, desc, action in personas:
        cursor.execute("INSERT INTO user_personas (type,pct,description,action) VALUES (?,?,?,?)", (tp, pct, desc, action))

    conn.commit()
    conn.close()
    print("Seed data inserted successfully.")


if __name__ == "__main__":
    seed()
