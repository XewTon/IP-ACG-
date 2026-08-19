import sqlite3
import os
from config import DATABASE_PATH


def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    # 启用外键约束（SQLite 默认关闭；开启后 DELETE/INSERT 会校验引用完整性）
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            followers INTEGER DEFAULT 0,
            reads_views INTEGER DEFAULT 0,
            interactions INTEGER DEFAULT 0,
            engagement_rate REAL DEFAULT 0.0,
            top_content TEXT DEFAULT '[]',
            recorded_at TEXT NOT NULL DEFAULT (date('now'))
        );

        CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            title TEXT NOT NULL,
            content_type TEXT DEFAULT '',
            scheduled_at TEXT,
            published_at TEXT,
            status TEXT DEFAULT 'draft',
            reads_views INTEGER DEFAULT 0,
            interactions INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS competitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            name TEXT NOT NULL,
            uid TEXT NOT NULL,
            followers INTEGER DEFAULT 0,
            content_count INTEGER DEFAULT 0,
            avg_engagement INTEGER DEFAULT 0,
            last_updated TEXT
        );

        CREATE TABLE IF NOT EXISTS follower_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            platform TEXT NOT NULL,
            followers INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS ips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            name_en TEXT DEFAULT '',
            type TEXT DEFAULT '',
            launch_date TEXT,
            target_users TEXT DEFAULT '',
            commercial_score REAL DEFAULT 0,
            heat_index REAL DEFAULT 0,
            activity_index REAL DEFAULT 0,
            sentiment_index REAL DEFAULT 0,
            description TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS characters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            role TEXT DEFAULT '',
            tag TEXT DEFAULT '',
            keywords TEXT DEFAULT '',
            description TEXT DEFAULT '',
            assets TEXT DEFAULT '',
            commercial_value REAL DEFAULT 0,
            FOREIGN KEY (ip_id) REFERENCES ips(id)
        );

        CREATE TABLE IF NOT EXISTS character_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id INTEGER NOT NULL,
            version TEXT NOT NULL,
            date TEXT,
            description TEXT DEFAULT '',
            FOREIGN KEY (character_id) REFERENCES characters(id)
        );

        CREATE TABLE IF NOT EXISTS character_daily_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            search_index INTEGER DEFAULT 0,
            discussions INTEGER DEFAULT 0,
            fan_growth INTEGER DEFAULT 0,
            fanworks INTEGER DEFAULT 0,
            commercial_score REAL DEFAULT 0,
            FOREIGN KEY (character_id) REFERENCES characters(id)
        );

        CREATE TABLE IF NOT EXISTS character_relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_character_id INTEGER,
            to_character_id INTEGER,
            from_label TEXT DEFAULT '',
            to_label TEXT DEFAULT '',
            relation_type TEXT NOT NULL,
            note TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS lore_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_id INTEGER NOT NULL,
            date_label TEXT NOT NULL,
            event TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (ip_id) REFERENCES ips(id)
        );

        CREATE TABLE IF NOT EXISTS ip_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            FOREIGN KEY (ip_id) REFERENCES ips(id)
        );

        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'planned',
            start_date TEXT,
            end_date TEXT,
            channel TEXT DEFAULT '',
            exposure INTEGER DEFAULT 0,
            participants INTEGER DEFAULT 0,
            conversion_rate REAL DEFAULT 0,
            roi REAL DEFAULT 0,
            notes TEXT DEFAULT '',
            FOREIGN KEY (ip_id) REFERENCES ips(id)
        );

        CREATE TABLE IF NOT EXISTS sentiment_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            positive REAL DEFAULT 0,
            neutral REAL DEFAULT 0,
            negative REAL DEFAULT 0,
            keywords TEXT DEFAULT '[]',
            risk_level TEXT DEFAULT 'low',
            summary TEXT DEFAULT '',
            FOREIGN KEY (ip_id) REFERENCES ips(id)
        );

        CREATE TABLE IF NOT EXISTS content_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            postiz_channel_id TEXT DEFAULT '',
            title TEXT NOT NULL,
            body TEXT DEFAULT '',
            media_urls TEXT DEFAULT '',
            scheduled_at TEXT DEFAULT '',
            status TEXT DEFAULT 'draft',
            reviewer_note TEXT,
            reviewed_by TEXT,
            postiz_post_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT DEFAULT '',
            budget TEXT DEFAULT '',
            mode TEXT DEFAULT '',
            on_time INTEGER DEFAULT 0,
            revisions REAL DEFAULT 0,
            score REAL DEFAULT 0,
            contact TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS supply_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER NOT NULL,
            task TEXT NOT NULL,
            deadline TEXT DEFAULT '',
            status TEXT DEFAULT '待派单',
            overdue_days INTEGER DEFAULT 0,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );

        CREATE TABLE IF NOT EXISTS community_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            user_name TEXT DEFAULT '',
            content TEXT NOT NULL,
            sentiment TEXT DEFAULT 'neutral',
            role_type TEXT DEFAULT '',
            date TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS community_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT DEFAULT '',
            title TEXT NOT NULL,
            level TEXT DEFAULT 'green',
            action TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS user_personas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            pct INTEGER DEFAULT 0,
            description TEXT DEFAULT '',
            action TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS client_requirements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            source TEXT DEFAULT '',
            priority TEXT DEFAULT '中',
            deadline TEXT DEFAULT '',
            status TEXT DEFAULT '未处理',
            linked_task_ids TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        -- ==================== 玄机科技知识库（面试备战 · 真实公开数据） ====================
        CREATE TABLE IF NOT EXISTS xuanji_kpis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            revenue REAL DEFAULT 0,
            net_profit REAL DEFAULT 0,
            net_margin REAL DEFAULT 0,
            tencent_share REAL DEFAULT 0,
            top5_client_share REAL DEFAULT 0,
            agency_share REAL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS xuanji_ips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            stage TEXT DEFAULT '',
            status TEXT DEFAULT '',
            progress TEXT DEFAULT '',
            lifecycle TEXT DEFAULT '',
            platform TEXT DEFAULT '',
            commercial TEXT DEFAULT '',
            tags TEXT DEFAULT '',
            heat INTEGER DEFAULT 0,
            discussion INTEGER DEFAULT 0,
            fanwork INTEGER DEFAULT 0,
            pay_convert INTEGER DEFAULT 0,
            reputation INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS xuanji_ipo_timeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_label TEXT NOT NULL,
            title TEXT NOT NULL,
            detail TEXT DEFAULT '',
            level TEXT DEFAULT 'normal'
        );

        CREATE TABLE IF NOT EXISTS xuanji_inquiry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            no TEXT NOT NULL,
            topic TEXT NOT NULL,
            concern TEXT NOT NULL,
            reply TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS xuanji_shareholders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            note TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS xuanji_bili (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            layer TEXT NOT NULL,
            name TEXT NOT NULL,
            value REAL NOT NULL,
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS xuanji_bili_ips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            play_w10k REAL DEFAULT 0,
            fanwork_w REAL DEFAULT 0,
            danmaku REAL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS xuanji_knowledge (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module TEXT NOT NULL,
            module_no INTEGER DEFAULT 0,
            title TEXT NOT NULL,
            desc TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS xuanji_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_label TEXT NOT NULL,
            headline TEXT NOT NULL,
            detail TEXT DEFAULT '',
            tags TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS xuanji_strategy (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            combo TEXT NOT NULL,
            mode TEXT NOT NULL,
            feasibility TEXT DEFAULT '',
            effect TEXT DEFAULT '',
            priority TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS xuanji_supply (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            name TEXT NOT NULL,
            cost TEXT DEFAULT '',
            pricing TEXT DEFAULT '',
            channel TEXT DEFAULT '',
            risk TEXT DEFAULT '',
            note TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS xuanji_revenue_target (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            current_pct REAL DEFAULT 0,
            target_pct REAL DEFAULT 0,
            path TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS xuanji_feed (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fetch_date TEXT NOT NULL,
            keyword TEXT DEFAULT '',
            category TEXT DEFAULT '',
            title TEXT NOT NULL,
            url TEXT DEFAULT '',
            summary TEXT DEFAULT '',
            score INTEGER DEFAULT 0,
            interview_value TEXT DEFAULT '',
            raw_content TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS xuanji_news_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT NOT NULL,
            category TEXT DEFAULT '',
            enabled INTEGER DEFAULT 1
        );
    """)

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DATABASE_PATH}")
