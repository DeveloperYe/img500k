# 图片压缩器

> 纯前端图片压缩工具 · 批量 / 直链 / ZIP 解压 · 自定义目标体积上限 · 全程浏览器本地处理

图片压缩器是一个**纯前端、零后端、零上传**的图片压缩工具。它利用浏览器原生能力与开源压缩库，在本机直接完成图片体积压缩，图片数据不会离开你的设备，也不会被上传到任何服务器。

在线使用：<https://developerye.github.io/img500k/>

## 功能特性

- **多种导入方式**
  - 本地上传：多选图片或直接拖拽到页面
  - 图片直链：粘贴图片 URL 在线加载（源站不支持跨域时自动走公共图片代理兜底）
  - ZIP 解压：上传含图片的压缩包，自动解压出图片进行处理（支持 JPG / PNG / WebP / GIF / BMP）
- **可调目标体积上限**
  - 预设档位滑块：200KB / 500KB / 1MB / 2MB / 5MB
  - 支持手动输入任意数值（10KB ~ 10MB），滑块与输入框双向联动
  - 修改目标上限后会自动按新上限重新压缩
- **智能压缩策略**
  - 优先保持原始分辨率，只降画质
  - 仍超限才等比缩小尺寸
  - PNG 超限时自动转为 WebP/JPEG（透明底会变白，可选开关）
- **多种下载方式**
  - 逐张下载 / 批量下载
  - 打包为 ZIP 下载

## 快速开始

项目为纯静态文件，无需构建与依赖安装。

```bash
# 本地起一个静态服务器即可
python -m http.server 8080
# 或
npx serve .
```

然后在浏览器打开 `http://localhost:8080`。

## 技术栈

- 原生 HTML / CSS / JavaScript（无框架）
- [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) —— 浏览器端图片压缩
- [JSZip](https://github.com/Stuk/jszip) —— ZIP 打包与解压

## 隐私声明

所有图片均在你的浏览器本地压缩，**不会上传到任何服务器**。图片直链功能仅用于加载你提供的公开图片 URL。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。

## 第三方开源组件与许可证

本项目通过 jsdelivr CDN 引用以下 MIT 协议开源库，仅用于本工具的运行，未对源码做任何修改。各自版权归其原作者所有。

| 组件 | 版本 | 许可证 | 版权所有者 |
| --- | --- | --- | --- |
| browser-image-compression | 2.0.2 | MIT | Donaldcwl |
| JSZip | 3.10.1 | MIT | Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso |

### 许可证原文

- **browser-image-compression**（MIT）：<https://opensource.org/licenses/MIT>
- **JSZip**（MIT）：<https://opensource.org/licenses/MIT>

第三方库的完整许可证文本与版权声明，请以各库仓库内 `LICENSE` 文件为准。

---

如对该项目的合规性、依赖清单或使用方式有任何疑问，欢迎通过 GitHub Issues 提出。