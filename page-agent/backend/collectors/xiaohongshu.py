"""
小红书数据采集器
从小红书公开页面采集账号数据
"""
import re
from collectors import BaseCollector


class XiaohongshuCollector(BaseCollector):
    platform = "xiaohongshu"

    async def collect(self, account_uid: str) -> dict:
        """
        采集小红书账号数据。

        真实实现思路（当前为模拟框架）：
        1. 访问 xiaohongshu.com/user/profile/{uid}
        2. 小红书反爬极严，通常需要：
           - 手机App端签名算法（x-s, x-t, x-s-common）
           - 或使用小红书开放平台API（需要企业资质）
           - Web端需要滑块验证码
        3. 可行的半自动方案：
           - 使用Playwright + 已登录的浏览器Profile
           - 人工完成首次登录，后续复用Storage State

        当前版本：返回模拟数据用于演示。
        """
        page = await self.new_page()
        try:
            await page.goto(
                f"https://www.xiaohongshu.com/user/profile/{account_uid}",
                wait_until="domcontentloaded",
            )

            try:
                # 小红书用户页粉丝数
                followers_text = await page.text_content(".user-info .count")
                followers = self._parse_number(followers_text)
            except Exception:
                followers = 0

            await page.close()

            if followers == 0:
                return self._mock_data("小红书页面解析失败")

            return {
                "followers": followers,
                "reads_views": followers * 8,  # 小红书笔记阅读量估算
                "interactions": int(followers * 0.19),
                "error": None,
            }
        except Exception as e:
            await page.close()
            return self._mock_data(str(e))

    @staticmethod
    def _parse_number(text: str) -> int:
        if not text:
            return 0
        text = text.strip()
        if "万" in text:
            num = float(re.sub(r"[^\d.]", "", text))
            return int(num * 10000)
        return int(re.sub(r"[^\d]", "", text) or 0)
