"""
微博数据采集器
从微博公开页面采集账号数据
"""
import re
from collectors import BaseCollector


class WeiboCollector(BaseCollector):
    platform = "weibo"

    async def collect(self, account_uid: str) -> dict:
        """
        采集微博账号数据。

        真实实现思路（当前为模拟框架）：
        1. 访问 weibo.com/u/{uid} 或 weibo.com/{nickname}
        2. 解析粉丝数、微博数
        3. 逐条解析近期微博的阅读量和互动量
        4. 微博反爬严格，通常需要：
           - 登录Cookie（有效期短）
           - 控制频率（极易触发验证码）
           - 或使用移动端API（weibo.cn）

        当前版本：返回模拟数据用于演示。
        """
        page = await self.new_page()
        try:
            await page.goto(f"https://weibo.com/u/{account_uid}", wait_until="domcontentloaded")

            try:
                # 微博页面粉丝数通常在 head 区域
                followers_text = await page.text_content(".tb_counter .t_link")
                followers = self._parse_number(followers_text)
            except Exception:
                followers = 0

            await page.close()

            if followers == 0:
                return self._mock_data("微博页面解析失败")

            return {
                "followers": followers,
                "reads_views": followers * 2,  # 微博阅读量估算
                "interactions": int(followers * 0.013),
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
