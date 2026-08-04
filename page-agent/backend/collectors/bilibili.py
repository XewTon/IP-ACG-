"""
B站数据采集器
从创作者中心 / 公开页面采集账号数据和内容表现
"""
import re
from collectors import BaseCollector


class BilibiliCollector(BaseCollector):
    platform = "bilibili"

    async def collect(self, account_uid: str) -> dict:
        """
        采集B站账号数据。

        真实实现思路（当前为模拟框架）：
        1. 访问 space.bilibili.com/{uid}
        2. 解析页面获取：粉丝数、总播放量
        3. 访问创作中心获取单条视频详细数据
        4. 需要处理B站的反爬机制（UA检测、频率限制）

        当前版本：返回模拟数据用于演示。
        切换到真实采集需：
        - 配置B站账号Cookie
        - 实现验证码识别/手动登录
        - 控制请求频率
        """
        page = await self.new_page()
        try:
            await page.goto(f"https://space.bilibili.com/{account_uid}", wait_until="domcontentloaded")

            # 尝试解析粉丝数（B站页面结构会变化，此处为示意）
            try:
                followers_text = await page.text_content(".n-followers .n-data-v")
                followers = self._parse_number(followers_text)
            except Exception:
                followers = 0

            # 尝试解析播放量
            try:
                views_text = await page.text_content(".n-video .n-data-v")
                reads_views = self._parse_number(views_text)
            except Exception:
                reads_views = 0

            await page.close()

            if followers == 0:
                return self._mock_data("B站页面解析失败")

            return {
                "followers": followers,
                "reads_views": reads_views,
                "interactions": int(reads_views * 0.058),  # 估算互动量
                "error": None,
            }
        except Exception as e:
            await page.close()
            return self._mock_data(str(e))

    @staticmethod
    def _parse_number(text: str) -> int:
        """解析B站的数字显示格式（如 '8.4万' -> 84000）"""
        if not text:
            return 0
        text = text.strip()
        if "万" in text:
            num = float(re.sub(r"[^\d.]", "", text))
            return int(num * 10000)
        return int(re.sub(r"[^\d]", "", text) or 0)

    def _mock_data(self, error_msg: str = "") -> dict:
        data = super()._mock_data(error_msg)
        data["reads_views"] += 2000  # B站视频播放量基数更大
        return data
