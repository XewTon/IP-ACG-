# -*- coding: utf-8 -*-
"""
玄策 · 开机立绘深度图生成脚本（可选增强，一次性运行）

用途
----
用开源深度模型 Depth Anything V2 (Small) 给启动立绘生成高精度深度图，
前端开机动画的立体立绘会优先读取 public/splash_depth.png 作置换深度
（比亮度近似更接近「真 3D 建模」的立体感）。不跑本脚本也不影响功能，
前端自动回退到亮度浮雕。

运行环境
--------
需要联网一次（下载 ~24MB ONNX 权重）。依赖：onnxruntime / opencv-python / numpy
    pip install onnxruntime opencv-python numpy
    python scripts/generate_splash_depth.py

产物
----
page-agent/frontend/public/splash_depth.png （与原立绘同尺寸的灰度深度图）
生成后提交仓库即可，演示机器离线也能用。

开源致谢：Depth Anything V2 (Lihe Yang et al., 2024, Apache-2.0 / CC-BY-NC 4.0)
"""
import os
import sys
import urllib.request

import cv2
import numpy as np
import onnxruntime as ort

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_URL = "https://huggingface.co/depth-anything/Depth-Anything-V2-Small/resolve/main/depth_anything_v2_vits.onnx"
MODEL_FILE = os.path.join(ROOT, "scripts", "depth_anything_v2_vits.onnx")
SRC = os.path.join(ROOT, "page-agent", "frontend", "public", "splash_figure.webp")
OUT = os.path.join(ROOT, "page-agent", "frontend", "public", "splash_depth.png")
INPUT_SIZE = 518
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def download(url: str, dest: str) -> None:
    if os.path.exists(dest) and os.path.getsize(dest) > 1_000_000:
        print(f"[skip] 模型已存在: {dest}")
        return
    print(f"[下载] {url}")
    urllib.request.urlretrieve(url, dest)
    print("[完成] 模型下载完成")


def main() -> None:
    if not os.path.exists(SRC):
        print(f"[错误] 找不到立绘: {SRC}")
        sys.exit(1)
    download(MODEL_URL, MODEL_FILE)

    img = cv2.imread(SRC)  # BGR
    if img is None:
        print("[错误] 立绘读取失败")
        sys.exit(1)
    h, w = img.shape[:2]

    # Depth Anything V2 标准预处理：RGB、resize 到 518、ImageNet 归一化、NCHW
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    x = (resized.astype(np.float32) / 255.0 - MEAN) / STD
    x = np.transpose(x, (2, 0, 1))[None].astype(np.float32)

    sess = ort.InferenceSession(MODEL_FILE, providers=["CPUExecutionProvider"])
    out = sess.run(None, {sess.get_inputs()[0].name: x})[0]  # (1,1,518,518)
    depth = out[0, 0]
    depth = cv2.resize(depth, (w, h), interpolation=cv2.INTER_LINEAR)

    # 归一化：亮=近（人物前景鼓出，背景光晕凹陷），立绘主体自然成为最亮区
    dmin, dmax = float(depth.min()), float(depth.max())
    depth8 = ((depth - dmin) / (dmax - dmin + 1e-8) * 255.0).astype(np.uint8)
    cv2.imwrite(OUT, depth8)
    print(f"[完成] 已生成 {OUT}  ({w}x{h})")
    print("[提示] 刷新页面即可生效；删除该文件即回退亮度浮雕")


if __name__ == "__main__":
    main()
