"""
预置玄机科技旗下 IP 运营演示数据（官网 xjent.com 收录 + 可编辑维护）—— 玄策决策闭环种子。
"""
import json
from datetime import date, timedelta
from database import get_db, init_db


def seed():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # 幂等保护：核心演示表已有数据时跳过，绝不清空用户数据（社区同步/排期/供应商等）
    try:
        cursor.execute("SELECT COUNT(*) AS c FROM ips")
        if cursor.fetchone()["c"] > 0:
            conn.close()
            print("[seed] ips 已有数据，跳过种子灌入（保护用户数据）")
            return
    except Exception:
        pass

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
             {"title": "角色PV-盖聂", "views": 71300, "interactions": 8030},
             {"title": "角色PV-少司命", "views": 68900, "interactions": 7690},
             {"title": "世界观解说：苍龙七宿", "views": 46100, "interactions": 4550},
         ], ensure_ascii=False)),
        ("weibo", 5100, 2200, 65, 3.0,
         json.dumps([
             {"title": "幕后花絮：盖聂立绘线稿公开", "reads": 3800, "interactions": 120},
             {"title": "互动投票：你最喜欢哪个角色", "reads": 4200, "interactions": 210},
             {"title": "少司命角色美学九宫格", "reads": 3100, "interactions": 95},
         ], ensure_ascii=False)),
        ("xiaohongshu", 2200, 1900, 420, 22.1,
         json.dumps([
             {"title": "东方美学天花板｜秦时明月水墨图鉴", "reads": 5200, "interactions": 2300},
             {"title": "如果你喜欢东方美学，一定爱《秦时明月》", "reads": 3800, "interactions": 1500},
             {"title": "水墨风角色穿搭灵感｜少司命篇", "reads": 2800, "interactions": 890},
         ], ensure_ascii=False)),
        ("wechat", 3150, 1200, 35, 0,
         json.dumps([
             {"title": "深度特辑：苍龙七宿谜题", "reads": 1800, "interactions": 52},
             {"title": "运营手记：做《秦时明月》社群这三个月", "reads": 1500, "interactions": 68},
             {"title": "角色深读：盖聂的剑道与守护", "reads": 1200, "interactions": 41},
         ], ensure_ascii=False)),
    ]
    for platform, followers, reads, interactions, rate, top in metrics:
        cursor.execute(
            """INSERT INTO metrics (platform, followers, reads_views, interactions, engagement_rate, top_content, recorded_at, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'seed')""",
            (platform, followers, reads, interactions, rate, top, today),
        )

    contents = [
        ("bilibili", "秦时明月·先导PV", "视频", "2025-04-28 18:00", "2025-04-28 18:00", "published", 87200, 12620),
        ("bilibili", "世界观#1：百家争鸣的背景", "视频", "2025-05-05 18:00", "2025-05-05 18:00", "published", 52300, 7950),
        ("bilibili", "世界观#2：鬼谷纵横", "视频", "2025-05-12 18:00", "2025-05-12 18:00", "published", 38100, 5580),
        ("bilibili", "角色PV-盖聂", "视频", "2025-05-19 18:00", "2025-05-19 18:00", "published", 63500, 10550),
        ("bilibili", "世界观#4：墨家的传承", "视频", "2025-06-02 18:00", "2025-06-02 18:00", "published", 44800, 6650),
        ("bilibili", "角色PV-少司命", "视频", "2025-06-09 18:00", "2025-06-09 18:00", "published", 71300, 11680),
        ("bilibili", "世界观#6：阴阳家", "视频", "2025-06-23 18:00", "2025-06-23 18:00", "published", 46100, 6250),
        ("bilibili", "角色PV-卫庄", "视频", "2025-06-30 18:00", "2025-06-30 18:00", "published", 68900, 9690),
        ("weibo", "盖聂角色九宫格首发", "图文", "2025-04-28 10:00", "2025-04-28 10:00", "published", 4500, 180),
        ("weibo", "幕后花絮：废稿分享", "图文", "2025-05-10 21:00", "2025-05-10 21:00", "published", 3800, 145),
        ("weibo", "互动投票：下个角色PV选谁", "互动", "2025-06-05 12:30", "2025-06-05 12:30", "published", 4200, 210),
        ("xiaohongshu", "东方美学天花板｜秦时明月水墨图鉴", "笔记", "2025-05-02 12:00", "2025-05-02 12:00", "published", 5200, 2300),
        ("xiaohongshu", "国漫美学入门｜秦时明月角色图集", "笔记", "2025-05-20 12:00", "2025-05-20 12:00", "published", 3800, 1500),
        ("wechat", "创刊号：深度特辑·苍龙七宿", "长文", "2025-04-28 21:00", "2025-04-28 21:00", "published", 2100, 72),
        ("wechat", "深度特辑·苍龙七宿与诸子百家", "长文", "2025-06-10 21:00", "2025-06-10 21:00", "published", 1800, 52),
        ("bilibili", "世界观#7：机关术与墨家技艺", "视频", "2025-07-07 18:00", None, "scheduled", 0, 0),
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

    # ========== IP（玄机旗下作品 · 来源 xjent.com 官网收录） ==========
    IP_LIST = [
        ("秦时明月", "Qin's Moon", "国产动画·历史武侠", "2007-02-14", "全年龄段国漫观众", 92, 88, 82, 86,
         "玄机科技旗舰作品。以秦末汉初为背景的历史武侠动画，国内首批 3D 动画代表作之一。"),
        ("天行九歌", "Tian Xing Jiu Ge", "国产动画·历史权谋", "2016-03-10", "18-30岁剧情向观众", 88, 85, 80, 84,
         "《秦时明月》前传，聚焦韩非、卫庄、紫女等角色的权谋群像。"),
        ("武庚纪", "Wu Geng Ji", "国产动画·东方神话", "2016-06-24", "热血玄幻受众", 85, 84, 78, 82,
         "改编自《封神纪》，以不屈意志反抗神权为核心主题。"),
        ("斗罗大陆", "Soul Land", "国产动画·玄幻热血", "2018-01-20", "玄幻网文受众", 95, 90, 84, 88,
         "改编自唐家三少同名小说，年番长线运营标杆，累计播放量百亿级。"),
        ("天宝伏妖录", "Tian Bao Fu Yao Lu", "国产动画·古风玄幻", "2020-07-05", "古风与同人文化受众", 82, 80, 76, 80,
         "改编自非天夜翔同名小说，唐代背景降妖伏魔群像。"),
        ("吞噬星空", "Swallowed Star", "国产动画·科幻末世", "2020-11-29", "科幻+热血受众", 84, 83, 79, 81,
         "改编自我吃西红柿同名小说，末世科幻武道题材。"),
        ("师兄啊师兄", "Shi Xiong Ah Shi Xiong", "国产动画·仙侠喜剧", "2023-03-03", "轻松搞笑向受众", 78, 82, 80, 76,
         "改编自言归正传《我师兄实在太稳健了》，苟道仙侠喜剧。"),
        ("斗罗大陆Ⅱ绝世唐门", "Soul Land II: Jue Shi Tang Men", "国产动画·玄幻", "2022-05-28", "斗罗IP粉丝", 90, 86, 80, 84,
         "《斗罗大陆》系列续作，以霍雨浩成长为主线。"),
        ("天谕", "Tian Yu", "国产动画·东方幻想", "2021-01-30", "游戏改编受众", 76, 78, 75, 72,
         "改编自网易同名端游，东方幻想题材。"),
        ("牧神记", "Mu Shen Ji", "国产动画·东方玄幻", "2025-01-01", "玄幻小说受众", 74, 76, 74, 70,
         "改编自宅猪同名小说，东方玄幻题材（2025 新作，官网收录中）。"),
    ]
    ip_ids = {}
    for name, name_en, type_, launch, target, heat, activity, sentiment_i, commercial, desc in IP_LIST:
        cursor.execute(
            """INSERT INTO ips (name, name_en, type, launch_date, target_users, commercial_score,
               heat_index, activity_index, sentiment_index, description)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, name_en, type_, launch, target, commercial, heat, activity, sentiment_i, desc),
        )
        ip_ids[name] = cursor.lastrowid
    ip_id = ip_ids["秦时明月"]  # 驾驶舱默认 IP = 秦时明月（官网收录）

    # ========== 角色（官网收录 · 指标为演示估算） ==========
    CHAR_LIST = [
        ("秦时明月", "盖聂", "剑圣·鬼谷传人", "主线角色", "天下第一剑、稳健、重情",
         "《秦时明月》核心角色，鬼谷派传人，以「天下第一剑」著称，守护天明。", "官网立绘/海报", 90),
        ("秦时明月", "天明", "荆轲之子·墨家", "主角", "成长、热血、仁厚",
         "《秦时明月》主角，墨家钜子候选人，身世与「苍龙七宿」之谜相关。", "官网立绘/海报", 85),
        ("秦时明月", "少司命", "阴阳家·少司命", "人气角色", "沉默、神秘、叶语",
         "阴阳家五行长老之一，以叶片为媒介的「万叶飞花流」，人气极高。", "官网立绘/海报", 88),
        ("秦时明月", "卫庄", "鬼谷传人·流沙首领", "人气角色", "冷峻、强大、亦正亦邪",
         "鬼谷派传人，流沙组织首领，与盖聂为同门师兄弟。", "官网立绘/海报", 87),
        ("秦时明月", "雪女", "墨家·舞姬", "重要角色", "清冷、笛声、舞",
         "墨家成员，以琴舞与冰雪系技能著称。", "官网立绘/海报", 78),
        ("天行九歌", "韩非", "韩国九公子·法家", "主角", "谋略、洒脱、法家",
         "《天行九歌》主角，韩国九公子，法家集大成者，与卫庄、紫女共创「流沙」。", "官网立绘/海报", 84),
        ("天行九歌", "卫庄", "鬼谷传人·流沙", "人气角色", "冷峻、强大",
         "青年时期的卫庄，与韩非、紫女共组流沙。", "官网立绘/海报", 86),
        ("天行九歌", "焰灵姬", "火魅术·天泽部属", "人气角色", "美艳、火系、神秘",
         "天泽麾下，掌握火魅术，人气居高不下。", "官网立绘/海报", 85),
        ("天行九歌", "紫女", "紫兰轩主人·流沙", "重要角色", "优雅、神秘",
         "紫兰轩主人，流沙核心成员，与韩非关系密切。", "官网立绘/海报", 80),
        ("武庚纪", "武庚", "纣王之子", "主角", "不屈、反抗、成长",
         "《武庚纪》主角，以不屈意志反抗神权。", "官网立绘/海报", 82),
        ("武庚纪", "白菜", "武庚恋人", "重要角色", "坚韧、善良",
         "与武庚共同抗争的神隐部少女。", "官网立绘/海报", 74),
        ("斗罗大陆", "唐三", "双生武魂·史莱克七怪", "主角", "双生武魂、暗器、重生",
         "《斗罗大陆》主角，前世唐门外门弟子，双生武魂（蓝银草/昊天锤）。", "官网立绘/海报", 93),
        ("斗罗大陆", "小舞", "十万年魂兽", "女主", "十万年魂兽、柔骨兔",
         "女主角，十万年魂兽化形，与唐三的情感主线。", "官网立绘/海报", 90),
        ("斗罗大陆", "比比东", "武魂殿教皇", "重要角色", "野心、复杂",
         "武魂殿教皇，实力与野心兼具的反派核心。", "官网立绘/海报", 82),
        ("天宝伏妖录", "李景珑", "骠骑将军·降妖司", "主角", "孤胆、忠心",
         "《天宝伏妖录》主角，与孔鸿俊并肩降妖。", "官网立绘/海报", 78),
        ("天宝伏妖录", "孔鸿俊", "重明鸟化身", "主角", "纯粹、强大",
         "重明鸟化身，李景珑的伙伴。", "官网立绘/海报", 76),
        ("吞噬星空", "罗峰", "武者·极限武馆", "主角", "坚韧、进化",
         "《吞噬星空》主角，末世中的武者成长之路。", "官网立绘/海报", 80),
        ("师兄啊师兄", "李长寿", "齐源山小师侄", "主角", "稳健、苟、幽默",
         "《我师兄实在太稳健了》主角，把「稳健」贯彻到底的仙侠喜剧。", "官网立绘/海报", 76),
        ("斗罗大陆Ⅱ绝世唐门", "霍雨浩", "史莱克学院·主角", "主角", "精神武魂、成长",
         "《斗罗大陆Ⅱ绝世唐门》主角，精神系武魂开创者。", "官网立绘/海报", 84),
        ("斗罗大陆Ⅱ绝世唐门", "唐舞桐", "女主", "女主", "光明女神蝶",
         "女主角，武魂光明女神蝶。", "官网立绘/海报", 80),
    ]
    char_ids = {}
    for ipn, name, role, tag, keywords, desc, assets, cv in CHAR_LIST:
        cursor.execute(
            """INSERT INTO characters (ip_id, name, role, tag, keywords, description, assets, commercial_value)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (ip_ids[ipn], name, role, tag, keywords, desc, assets, cv),
        )
        char_ids[f"{ipn}|{name}"] = cursor.lastrowid

    # 版本历史（秦时明月主线角色 · 演示条目，可编辑）
    versions = {
        "秦时明月|盖聂": [
            ("v1.0 经典形象", "2007", "百步飞剑时期的剑圣形象（官网立绘）"),
            ("v2.0 沧海横流", "2021", "《沧海横流》形象优化（官网立绘）"),
        ],
        "秦时明月|天明": [
            ("v1.0 经典形象", "2007", "百步飞剑时期的少年形象（官网立绘）"),
            ("v2.0 沧海横流", "2021", "成长后的形象（官网立绘）"),
        ],
    }
    for key, vers in versions.items():
        for v, d, desc in vers:
            cursor.execute(
                "INSERT INTO character_versions (character_id, version, date, description) VALUES (?, ?, ?, ?)",
                (char_ids[key], v, d, desc),
            )

    # 角色日指标（近30天 · 演示估算，可编辑校准）
    import random as _rnd
    _rnd.seed(42)
    for key, cid in char_ids.items():
        base_search = _rnd.randint(45, 92)
        base_disc = _rnd.randint(320, 920)
        base_fan = _rnd.randint(12, 42)
        base_fw = _rnd.randint(8, 32)
        base_comm = round(_rnd.uniform(65, 93), 1)
        for day_offset in range(30, 0, -1):
            d = (date.today() - timedelta(days=day_offset)).isoformat()
            progress = (30 - day_offset) / 30
            # 近14天讨论抬升（模拟新内容带动）
            boost = 1.0 + (14 - day_offset) * 0.018 if day_offset <= 14 else 1.0
            search = int(base_search * (0.85 + 0.2 * progress) * boost)
            disc = int(base_disc * (0.8 + 0.35 * progress) * boost)
            fan = max(1, int(base_fan * (0.7 + 0.5 * progress) * boost))
            fw = max(0, int(base_fw * (0.75 + 0.4 * progress) * boost))
            comm = round(base_comm * (0.95 + 0.08 * progress) * min(boost, 1.08), 1)
            cursor.execute(
                """INSERT INTO character_daily_metrics
                   (character_id, date, search_index, discussions, fan_growth, fanworks, commercial_score, source)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'seed')""",
                (cid, d, search, disc, fan, fw, comm),
            )

    # 关系：角色 ↔ 角色 / 阵营 / 事件（官网设定收录）
    relations = [
        (char_ids["秦时明月|盖聂"], char_ids["秦时明月|天明"], "", "", "师徒", "盖聂守护并教导天明"),
        (char_ids["秦时明月|盖聂"], char_ids["秦时明月|卫庄"], "", "", "师兄弟·对手", "鬼谷同门，理念相左"),
        (char_ids["秦时明月|天明"], char_ids["秦时明月|雪女"], "", "", "同伴", "同属墨家阵营"),
        (char_ids["秦时明月|少司命"], None, "", "阴阳家", "从属", "阴阳家五行长老之一"),
        (char_ids["天行九歌|韩非"], char_ids["天行九歌|卫庄"], "", "", "合作", "共创流沙"),
        (char_ids["天行九歌|韩非"], char_ids["天行九歌|紫女"], "", "", "知己", "紫兰轩结缘"),
        (char_ids["天行九歌|焰灵姬"], char_ids["天行九歌|韩非"], "", "", "对立→追随", "天泽部属，后归流沙"),
        (char_ids["斗罗大陆|唐三"], char_ids["斗罗大陆|小舞"], "", "", "情侣", "情感主线"),
        (char_ids["斗罗大陆|唐三"], char_ids["斗罗大陆|比比东"], "", "", "对立", "武魂殿冲突"),
        (char_ids["天宝伏妖录|李景珑"], char_ids["天宝伏妖录|孔鸿俊"], "", "", "伙伴", "并肩降妖"),
        (char_ids["斗罗大陆Ⅱ绝世唐门|霍雨浩"], char_ids["斗罗大陆Ⅱ绝世唐门|唐舞桐"], "", "", "情侣", "史莱克学院相识"),
    ]
    for from_id, to_id, fl, tl, rtype, note in relations:
        cursor.execute(
            """INSERT INTO character_relations
               (from_character_id, to_character_id, from_label, to_label, relation_type, note)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (from_id, to_id, fl, tl, rtype, note),
        )

    # 世界观时间线（作品关键节点 · 公开信息）
    lore = [
        ("秦时明月", 0, "2007", "《秦时明月之百步飞剑》首播 —— 玄机旗舰IP启程"),
        ("秦时明月", 1, "2010", "《夜尽天明》播出"),
        ("秦时明月", 2, "2012", "《诸子百家》播出"),
        ("秦时明月", 3, "2014", "《万里长城》播出"),
        ("秦时明月", 4, "2016", "《君临天下》播出"),
        ("秦时明月", 5, "2021", "《沧海横流》播出（秦时明月伍）"),
        ("天行九歌", 0, "2016", "《天行九歌》首播 —— 秦时明月前传"),
        ("武庚纪", 0, "2016", "《武庚纪》首播"),
        ("斗罗大陆", 0, "2018", "《斗罗大陆》动画首播，年番运营开启"),
        ("斗罗大陆", 1, "2021", "累计播放量破百亿，年番标杆"),
        ("天宝伏妖录", 0, "2020", "《天宝伏妖录》首播"),
        ("吞噬星空", 0, "2020", "《吞噬星空》首播"),
        ("斗罗大陆Ⅱ绝世唐门", 0, "2022", "《绝世唐门》首播"),
    ]
    for ipn, order, label, event in lore:
        cursor.execute(
            "INSERT INTO lore_events (ip_id, date_label, event, sort_order) VALUES (?, ?, ?, ?)",
            (ip_ids[ipn], label, event, order),
        )

    # IP 规范（内容运营红线 · 可编辑维护）
    rules = [
        ("视觉规范", "东方/水墨美学为基调；外包参考图 ≤5 张精确对标，禁止「广而全」"),
        ("视觉规范", "角色形象与官网设定保持一致，重大调整需走版本记录"),
        ("内容红线", "保持克制留白调性，不卖萌/不热血/不煽情式包装"),
        ("内容红线", "禁止角色间 CP 拉踩、粉丝站式语气与网络用语滥用"),
        ("内容红线", "不参与竞品重大发布日抢发同类型内容"),
        ("内容红线", "不泄露未公开设定；以官方渠道为准，禁止编造数据"),
        ("运营规范", "平台节奏：B站 1视频/周+3动态；微博 2-3条/天；小红书 5-6条/周；公众号 1-2篇/周"),
        ("运营规范", "风险事件分级响应：设定争议→官方短回应；重大舆情→专项预案"),
    ]
    for cat, content in rules:
        cursor.execute(
            "INSERT INTO ip_rules (ip_id, category, content) VALUES (?, ?, ?)",
            (ip_id, cat, content),
        )

    activities = [
        ("秦时明月·沧海横流完结纪念", "completed", "2025-05-19", "2025-05-25", "B站+微博", 86000, 12000, 4.8, 2.4, "完结热度集中"),
        ("秦时明月·盖聂角色周", "running", "2025-06-30", "2025-07-07", "B站+微博", 52000, 6800, 3.9, 1.9, "人气角色运营"),
        ("天行九歌·焰灵姬生日企划", "planned", "2025-08-15", "2025-08-22", "全平台", 0, 0, 0, 0, "待AI助手生成方案"),
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
           (ip_id, date, positive, neutral, negative, keywords, risk_level, summary, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seed')""",
        (
            ip_id, today, 58, 32, 10,
            json.dumps(["秦时明月", "盖聂", "天明", "沧海横流", "美术"], ensure_ascii=False),
            "low",
            "整体舆情健康。正面集中在角色与美术；负面主要为更新节奏与少量剧情讨论。",
        ),
    )

    # ========== 内容发布(Postiz) ==========
    content_posts = [
        ("bilibili", "int_bili_001", "世界观解析：苍龙七宿", "深度解读秦时明月核心谜题苍龙七宿的设定脉络", "2026-07-31T18:00:00", "draft", None, None, None),
        ("weibo", "int_weibo_001", "幕后花絮：盖聂立绘线稿", "废稿也是好稿——分享一组盖聂立绘的未采用版本", "2026-07-29T12:30:00", "draft", None, None, None),
        ("xiaohongshu", "int_xhs_001", "东方美学推荐笔记", "如果你喜欢东方美学，这份秦时明月水墨图集值得收藏", "2026-07-30T12:00:00", "pending_review", None, None, None),
        ("bilibili", "int_bili_001", "角色PV-少司命", "完整版少司命角色PV，含万叶飞花流动态特效", "2026-07-25T18:00:00", "scheduled", None, None, "postiz_sm"),
        ("wechat", "int_wx_001", "《沧海横流》完结特辑", "回顾秦时明月伍七年的创作幕后与数据复盘", "2026-07-30T21:00:00", "published", "运营负责人", "审核通过", "postiz_chl"),
        ("bilibili", "int_bili_001", "创作幕后vlog#2", "动画师的一天：从分镜到成片的制作流程", "2026-08-01T18:00:00", "draft", None, None, None),
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
        (sup_ids["星光漫画工作室"], "角色立绘修改·盖聂终稿", "2026-07-30", "进行中", 0),
        (sup_ids["独立设计师·陈"], "社媒物料·第12周批量", "2026-07-31", "待验收", 0),
        (sup_ids["动画师·赵"], "先导PV·初版提交", "2026-07-25", "逾期", 3),
        (sup_ids["星光漫画工作室"], "漫画序章·分镜稿", "2026-08-05", "待派单", 0),
    ]
    for sid, task, deadline, status, overdue in supply_tasks:
        cursor.execute("INSERT INTO supply_tasks (supplier_id,task,deadline,status,overdue_days) VALUES (?,?,?,?,?)", (sid, task, deadline, status, overdue))

    # ========== 社区（种子为演示登记；真实抓取见「数据采集→社区同步」） ==========
    feedbacks = [
        ("B站", "墨***", "水墨画风太绝了，秦时明月二十年如一日的美术", "positive", "美术党", "2026-07-25"),
        ("微博", "天***", "沧海横流看完意难平，求下一季快点来", "positive", "剧情党", "2026-07-24"),
        ("B站", "聂***", "盖聂这个角色太有味了，求多出角色PV", "positive", "角色党", "2026-07-23"),
        ("B站", "新***", "世界观有点复杂，看了两遍才明白苍龙七宿", "neutral", "剧情党", "2026-07-22"),
        ("小红书", "画***", "能不能多发点少司命的图啊", "neutral", "角色党", "2026-07-21"),
        ("公众号", "深***", "文章太硬核了能不能轻松一点", "negative", "剧情党", "2026-07-20"),
    ]
    for platform, uname, content, sentiment, role, dt in feedbacks:
        cursor.execute("INSERT INTO community_feedback (platform,user_name,content,sentiment,role_type,date) VALUES (?,?,?,?,?,?)", (platform, uname, content, sentiment, role, dt))

    events = [
        ("2026-07-28", "少司命角色PV评论区集中讨论角色设计", "green", "正常互动，无需干预"),
        ("2026-07-22", "世界观视频下出现'设定太复杂'集中评论", "yellow", "关注中·已调整下一期视频叙述结构"),
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

    # 幂等保护：知识库已有数据时跳过，避免每次启动重灌抹掉手工修改
    try:
        cursor.execute("SELECT COUNT(*) AS c FROM xuanji_kpis")
        if cursor.fetchone()["c"] > 0:
            conn.close()
            print("[seed] xuanji_kpis 已有数据，跳过知识库灌入")
            return
    except Exception:
        pass

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
