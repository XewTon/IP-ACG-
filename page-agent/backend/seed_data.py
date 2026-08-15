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


def seed_xuanji():
    """预置《玄机科技 IP 运营知识库》真实公开数据 —— 面试备战手册 + 数据看板。
    全部数据来自公开信息（招股书/问询函/百科/新闻），非虚构。"""
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    for table in [
        "xuanji_kpis", "xuanji_ips", "xuanji_ipo_timeline", "xuanji_inquiry",
        "xuanji_shareholders", "xuanji_bili", "xuanji_bili_ips",
        "xuanji_knowledge", "xuanji_reports", "xuanji_strategy",
        "xuanji_supply", "xuanji_revenue_target",
    ]:
        cursor.execute(f"DELETE FROM {table}")

    # ========== KPI：财务与客户集中度（手册 2.3） ==========
    kpis = [
        (2023, 2.62, 0.68, 26.0, 76.65, 90.0, 95.0),
        (2024, 3.17, 0.68, 21.0, 56.05, 90.0, 95.0),
        (2025, 4.02, 1.23, 31.0, 50.62, 90.0, 95.0),
    ]
    for y, rev, np_, nm, tenc, top5, ag in kpis:
        cursor.execute("INSERT INTO xuanji_kpis (year,revenue,net_profit,net_margin,tencent_share,top5_client_share,agency_share) VALUES (?,?,?,?,?,?,?)",
            (y, rev, np_, nm, tenc, top5, ag))

    # ========== IP 矩阵（手册 2.6 / 看板 ip-matrix） ==========
    ips = [
        ("斗罗大陆II绝世唐门", "巅峰期", "年番更新中", "EP166 · 预计2026.12完结", "巅峰期", "腾讯视频", "播放量玄机IP第一，手游联动核心", "年番|S+级|游戏联动", 95, 90, 85, 88, 82),
        ("吞噬星空", "稳定更新", "年番更新中", "EP235+ · 剧场版《决战原始星》", "稳定期", "腾讯视频", "月均播放稳定，剧场版上映", "年番|剧场版|科幻", 85, 75, 70, 80, 78),
        ("牧神记", "上升期", "新番更新中", "EP89-90 · B站9.7分", "上升期", "B站", "B站口碑上升，豆瓣9.7+", "新番|口碑发酵|社区种草", 60, 65, 55, 40, 97),
        ("秦时明月", "经典IP", "经典IP", "2007至今 · 7季 · 重制版讨论中", "复活期", "腾讯视频", "老粉基本盘大，商业化待释放", "元老IP|重制计划|情怀", 70, 60, 80, 30, 75),
        ("天行九歌", "跨媒介", "真人剧化", "91集 · 真人剧2026.7横店开机", "跨媒介期", "爱奇艺", "动画→真人剧破圈关键路径", "动画→真人|破圈|IP跨媒介", 50, 55, 45, 20, 70),
        ("武庚纪", "待激活", "待激活", "暂无更新 · 重启可行性待评估", "休眠期", "-", "神话题材红利，需评估重启", "休眠|需评估", 20, 25, 15, 10, 55),
        ("天宝伏妖录", "待定", "待定", "暂无更新 · 待评估", "休眠期", "-", "储备IP，待评估", "休眠|储备", 15, 20, 10, 8, 50),
    ]
    for name, stage, status, progress, lifecycle, platform, commercial, tags, heat, disc, fan, pay, rep in ips:
        cursor.execute("INSERT INTO xuanji_ips (name,stage,status,progress,lifecycle,platform,commercial,tags,heat,discussion,fanwork,pay_convert,reputation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (name, stage, status, progress, lifecycle, platform, commercial, tags, heat, disc, fan, pay, rep))

    # ========== IPO 时间线（看板 ipo 页） ==========
    timeline = [
        ("2025.07.30", "挂牌新三板", "资本化第一步", "normal"),
        ("2026.02", "完成IPO辅导", "进入冲刺阶段", "normal"),
        ("2026.04.03", "报送申请材料", "北交所审核启动", "normal"),
        ("2026.04.22", "北交所受理IPO申请", "正式进入审核流程", "normal"),
        ("2026.05.22", "发出首轮问询函", "审核进入深水区", "warning"),
        ("2026.08.03", "提交问询函回复", "进入新阶段，等待第二轮或上会", "normal"),
        ("待发生", "第二轮问询（预计）", "预计聚焦代理vs自营平衡和募投项目细化", "warning"),
        ("待发生", "上市委审议（预计）", "通过审核后进入上市委审议阶段", "danger"),
    ]
    for dt, title, detail, level in timeline:
        cursor.execute("INSERT INTO xuanji_ipo_timeline (date_label,title,detail,level) VALUES (?,?,?,?)", (dt, title, detail, level))

    # ========== 首轮问询五大问题（看板 ipo 页） ==========
    inquiries = [
        ("1", "业绩增长可持续性", "IP业务是否萎缩，收入增长是否可持续", "多IP矩阵布局+新IP储备+海外拓展"),
        ("2", "客户集中度", "前五大客户贡献超90%收入，腾讯系占比50%+", "腾讯占比从76%降至50%，持续拓展新客户"),
        ("3", "募资购楼合理性", "拟募资购置办公大楼，是否存在闲置风险", "产能扩张需求+团队规模增长+人员招聘费说明"),
        ("4", "股权激励合规性", "股权激励核算方法及合规性", "补充披露激励方案细节及会计处理"),
        ("5", "实控人任职合规", "沈乐平代持历史及实控人认定", "代持已清理，股权结构清晰，实控人认定合理"),
    ]
    for no, topic, concern, reply in inquiries:
        cursor.execute("INSERT INTO xuanji_inquiry (no,topic,concern,reply) VALUES (?,?,?,?)", (no, topic, concern, reply))

    # ========== 股权结构（看板 ipo 页） ==========
    shareholders = [
        ("沈乐平", "实际控制人/创始人", "代持历史已清理，IPO后仍为实控人"),
        ("腾讯（林芝利创）", "第二大股东 + 第一大客户", "双重身份是IPO问询重点，关联交易公允性被反复问询"),
        ("中信建投", "保荐机构", "负责IPO保荐及辅导"),
        ("核心员工持股平台", "员工激励", "股权激励已实施，覆盖核心创作团队"),
    ]
    for name, role, note in shareholders:
        cursor.execute("INSERT INTO xuanji_shareholders (name,role,note) VALUES (?,?,?)", (name, role, note))

    # ========== B站漏斗（看板 bili 页） ==========
    funnel = [
        ("曝光", "曝光（短视频切片触达）", 100, 0),
        ("兴趣", "兴趣（B站二创深度观看）", 35, 1),
        ("转化", "转化（腾讯视频付费会员）", 12, 2),
        ("留存", "留存（社区互动+UGC）", 6, 3),
        ("传播", "传播（自发推荐）", 2, 4),
    ]
    for layer, name, value, so in funnel:
        cursor.execute("INSERT INTO xuanji_bili (layer,name,value,sort_order) VALUES (?,?,?,?)", (layer, name, value, so))

    bili_ips = [
        ("斗罗大陆", 8500, 3200, 85),
        ("吞噬星空", 4200, 1800, 62),
        ("牧神记", 1800, 950, 45),
        ("秦时明月", 3200, 2400, 55),
        ("天行九歌", 1500, 850, 38),
    ]
    for name, play, fanwork, danmaku in bili_ips:
        cursor.execute("INSERT INTO xuanji_bili_ips (name,play_w10k,fanwork_w,danmaku) VALUES (?,?,?,?)", (name, play, fanwork, danmaku))

    # ========== 知识图谱六大模块（手册三/四/五/六章 + 看板 knowledge 页） ==========
    knowledge = [
        (1, "模块1：国漫产业认知", "产业规模与趋势", "2024年中国动漫产业市场规模约3000亿元，年增速约12%，网络动画占比超40%，Z世代占比超60%"),
        (1, "模块1：国漫产业认知", "播出平台格局", "一超多强：腾讯视频（国漫第一平台·独播年番）、B站（二创生态核心）、爱奇艺（真人剧+动画双线）、优酷/M站（长尾）、WeTV/海外（出海）"),
        (1, "模块1：国漫产业认知", "产业链结构", "IP→制作→播出→衍生→游戏→线下→海外网状结构；制作环节利润率10-20%，衍生环节30-50%，游戏授权是最大变现天花板"),
        (1, "模块1：国漫产业认知", "年番商业模式", "每周更新→用户持续回访→平台会员维系；价值链：播出收益→广告→会员转化→衍生变现"),
        (1, "模块1：国漫产业认知", "玄机与腾讯绑定", "腾讯是玄机第一大客户（2025年占比50.62%）同时是第二大股东，'客户+股东'双重身份是IPO问询核心关注点"),
        (2, "模块2：玄机公司深度", "发展历程", "2005成立→2007秦时明月→2013天行九歌→2016武庚纪→2018斗罗大陆爆发→2021吞噬星空年番→2025.7新三板→2026.4北交所受理→2026.8回复问询"),
        (2, "模块2：玄机公司深度", "股权结构与实控人", "实控人沈乐平三位一体（创始人+艺术总监+实控人）；腾讯第二大股东+第一大客户；历史代持问题已清理"),
        (2, "模块2：玄机公司深度", "财务数据", "营收：2023年2.62亿→2024年3.17亿→2025年4.02亿（复合增速24%）；净利2025年1.23亿（+80%）；净利率31%"),
        (2, "模块2：玄机公司深度", "业务构成", "代工（数字内容制作服务）占比超95%，自营IP（数字内容创作）占比低但增长空间大"),
        (2, "模块2：玄机公司深度", "IPO与问询", "北交所2026.4.22受理，8.3回复首轮问询：业绩可持续性、客户集中度、募资购楼、股权激励、实控人合规"),
        (3, "模块3：IP运营方法论", "IP生命周期管理", "孵化期→上升期→巅峰期→衰退期→复活期，各阶段运营重点与关键指标不同"),
        (3, "模块3：IP运营方法论", "IP价值评估模型", "四维评分法：知名度×美誉度×商业化潜力×延展性"),
        (3, "模块3：IP运营方法论", "跨媒介改编策略", "每跨一步有损耗率与增量；动画→游戏转化率高（斗罗手游标杆），动画→真人剧获取非动画用户（天行九歌）"),
        (3, "模块3：IP运营方法论", "粉丝经济", "1-9-90分层模型：核心粉1%（创作扶持）、活跃粉9%（二创激励）、路人粉90%（短视频触达）"),
        (3, "模块3：IP运营方法论", "内容运营", "选题热度预测、更新节奏控制（高峰时段）、悬念设计（影响回归率）、弹幕互动引导"),
        (3, "模块3：IP运营方法论", "品牌联名逻辑", "调性匹配×客群重合×合作深度：浅层授权/深度共创/战略联盟三层递进"),
        (4, "模块4：数据分析技能栈", "数据采集", "Python requests+BeautifulSoup、B站API、微博热搜API、问答平台/论坛"),
        (4, "模块4：数据分析技能栈", "数据处理", "pandas/numpy清洗透视、SQL留存/RFM分层、jieba+wordcloud词云、SnowNLP情感分析"),
        (4, "模块4：数据分析技能栈", "数据可视化", "matplotlib/seaborn静态图、plotly交互图、ECharts Web看板首选、Excel透视表"),
        (4, "模块4：数据分析技能栈", "用户行为漏斗", "曝光→兴趣→转化→留存→传播五层链路，每层有核心指标与优化方向"),
        (4, "模块4：数据分析技能栈", "竞品监控看板", "监控凡人修仙传/完美世界/斗破苍穹等同期IP，维度含播放/更新频率/平台排名/社媒讨论/二创"),
        (5, "模块5：平台运营规则", "腾讯视频", "动画推荐机制基于完播率/弹幕互动率/VIP转化率；S+级项目独播+首页推荐+超前点播"),
        (5, "模块5：平台运营规则", "B站", "弹幕文化、二创生态（创作激励计划）、分区运营、官方号动态/专栏/视频联动"),
        (5, "模块5：平台运营规则", "抖音/快手", "算法：完播率>点赞率>评论率>转发率；30秒高燃切片；矩阵号运营；DOU+投放"),
        (5, "模块5：平台运营规则", "小红书", "搜索关键词+点赞收藏分发；角色种草吸引女性用户；品牌合作人平台KOC/KOL"),
        (5, "模块5：平台运营规则", "微博", "超话运营、热搜话题打法、官微互动节奏（更新日预告/发幕后/传谣辟谣）、粉丝群管理"),
        (5, "模块5：平台运营规则", "线下展会", "CCG/萤火虫/CP展位规划、IP主题快闪店、沉浸式体验、现场转化数据"),
        (6, "模块6：政策与商业化", "广电监管", "网络动画备案制度、内容审查红线（暴力/血腥/服装暴露/历史虚无主义）、版号政策"),
        (6, "模块6：政策与商业化", "著作权法", "IP授权链条（原著作者→平台→制作方）、衍生品授权范围、同人创作法律边界"),
        (6, "模块6：政策与商业化", "游戏授权", "买断制/分成制/联合开发三模式；斗罗大陆手游累计流水超百亿为标杆案例"),
        (6, "模块6：政策与商业化", "衍生品供应链", "手办/谷子成本结构（模具+生产+包装）、定价逻辑（IP热度×角色人气×稀缺度）、库存周转风险"),
        (6, "模块6：政策与商业化", "海外发行", "文化出海政策支持、WeTV/YouTube Anime/Netflix合作模式、本地化成本差异"),
    ]
    for no, mod, title, desc in knowledge:
        cursor.execute("INSERT INTO xuanji_knowledge (module_no,module,title,desc) VALUES (?,?,?,?)", (no, mod, title, desc))

    # ========== 动态速报（看板 reports 页） ==========
    reports = [
        ("2026-08-11（周一）", "IPO问询函回复深度解析 + 周展望",
         "北交所8月3日披露玄机科技首轮问询回复全文，聚焦5大核心问题：业绩增长可持续性、客户集中度、募资购楼合理性、股权激励合规性、实控人任职合规性。代理服务模式数据全面曝光——2023-2025年腾讯系收入占比分别为76.65%、56.05%、50.62%，连续3年下降但仍超半数。本周展望：关注北交所是否发起第二轮问询、吞噬星空236集更新、绝世唐门EP166播出、牧神记第90话。",
         "IPO进展|面试素材：代理vs自营商业模式分析", 0),
        ("2026-08-10（周日·周末综述）", "本周IP内容更新回顾 + IPO问询函要点",
         "吞噬星空235集更新、绝世唐门EP166预告发布（霍雨浩开启亡灵大军）、牧神记89/90话预告。IPO问询函五大核心问题回顾：核心产品研发进展及商业化前景、股权激励核算、实控人任职合规性、募集资金规模合理性、客户集中度。",
         "吞噬星空|绝世唐门|牧神记|IPO问询", 1),
        ("2026-08-09（周六）", "玄机科技IPO首轮问询函回复提交 + 各IP动态汇总",
         "8月3日玄机科技及中介机构提交审核问询函回复，已在北交所官网披露。2025年全年营收4.02亿元（+26.54%），归母净利1.23亿元（+80.44%）。IP动态：牧神记年番更新至第89话B站9.7分；天行九歌真人剧7月横店开机；斗罗大陆II预计12月完结，神界传说2027年接棒。",
         "IPO受理|牧神记|天行九歌|斗罗大陆|面试素材：IPO进展话术", 2),
    ]
    for dt, headline, detail, tags, so in reports:
        cursor.execute("INSERT INTO xuanji_reports (date_label,headline,detail,tags,sort_order) VALUES (?,?,?,?,?)", (dt, headline, detail, tags, so))

    # ========== IP联动策略矩阵（看板 ip-matrix 页） ==========
    strategies = [
        ("秦时明月 × 天行九歌", "世界观共享·角色客串", "高", "老粉回归+新粉引流双向", "P0"),
        ("斗罗大陆 × 吞噬星空", "游戏联动·唐三vs罗峰限定活动", "高", "双IP用户池合并，游戏DAU提升", "P0"),
        ("牧神记 × 秦时明月", "风格联名·国风主题周边", "中", "牧神记借力老IP口碑加速破圈", "P1"),
        ("天行九歌真人剧 × 动画版", "同步宣发·互导流量", "高", "动画→真人破圈，拉新非二次元用户", "P0"),
        ("武庚纪 × 秦时明月", "共享世界观·封神线延伸", "低", "需先重启武庚纪，周期长", "P2"),
    ]
    for combo, mode, feas, effect, pri in strategies:
        cursor.execute("INSERT INTO xuanji_strategy (combo,mode,feasibility,effect,priority) VALUES (?,?,?,?,?)", (combo, mode, feas, effect, pri))

    # ========== 衍生品供应链（手册 6.4） ==========
    supply = [
        ("手办/谷子", "成本结构", "模具费+生产费+包装费", "IP热度×角色人气×稀缺度", "官方商城/授权商/展会", "模具一次性投入高，需评估首单量", "斗罗大陆手办为标杆案例", 0),
        ("联名服饰", "成本结构", "设计费+面料+生产", "品牌调性匹配×IP热度", "快消/服饰/食品品牌渠道", "品牌调性不匹配会损伤IP", "秦时明月×文创品牌为深度共创案例", 1),
        ("库存周转", "风险控制", "小批量快进快出", "精准需求预测", "预售模式/限量发售", "库存积压是衍生品最大风险", "核心IP巅峰期适合放量", 2),
        ("渠道分成", "商业化", "平台抽成+渠道佣金", "按渠道层级递减", "官方直营/分销/线下展位", "渠道冲突需价格体系约束", "线下展会同时承担拉新职能", 3),
    ]
    for cat, name, cost, pricing, channel, risk, note, so in supply:
        cursor.execute("INSERT INTO xuanji_supply (category,name,cost,pricing,channel,risk,note,sort_order) VALUES (?,?,?,?,?,?,?,?)",
            (cat, name, cost, pricing, channel, risk, note, so))

    # ========== 收入结构3年优化目标（手册 6.6） ==========
    targets = [
        ("代工制作服务", 95, 70, "自营IP收入增长自然稀释代工占比", 0),
        ("自营IP播出", 3, 10, "牧神记/新作品品牌运营", 1),
        ("衍生品", 1, 8, "手办/联名/数字藏品", 2),
        ("游戏授权", 1, 7, "拓展更多IP的游戏化", 3),
        ("海外发行", 0.5, 5, "WeTV/海外平台合作", 4),
    ]
    for source, cur, tgt, path, so in targets:
        cursor.execute("INSERT INTO xuanji_revenue_target (source,current_pct,target_pct,path,sort_order) VALUES (?,?,?,?,?)", (source, cur, tgt, path, so))

    conn.commit()
    conn.close()
    print("Xuanji seed data inserted successfully.")


if __name__ == "__main__":
    seed()
