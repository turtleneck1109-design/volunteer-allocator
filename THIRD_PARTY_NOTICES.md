# 第三方组件

本项目随包包含 SheetJS Community Edition 0.20.3，用于 Excel 解析与生成。

- 文件：`vendor/xlsx.full.min.js`（同时嵌入构建后的 HTML）
- 项目：https://github.com/SheetJS/sheetjs
- 版权：SheetJS，源文件内保留原版权标记。
- 许可：Apache License 2.0，全文见 `vendor/SheetJS-LICENSE.txt`。

SheetJS 内嵌的字符编码等组件保留其原始文件标记。本项目未修改供应商库文件。

## PDF 生成

- `vendor/pdf-lib.min.js`：pdf-lib 1.17.1，MIT，版权 Andrew Dillon；许可见 `vendor/pdf-lib-LICENSE.txt`。来源：https://github.com/Hopding/pdf-lib ，固定版本分发：https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js 。
- `vendor/fontkit.umd.min.js`：@pdf-lib/fontkit 1.1.1，MIT，基于 Devon Govett 的 fontkit，由 Andrew Dillon 维护此分支；许可见 `vendor/fontkit-LICENSE.txt`。来源：https://github.com/Hopding/fontkit ，固定版本分发：https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js 。
- `vendor/NotoSansSC-Regular.ttf`：Noto Sans SC，Adobe / Noto 项目，SIL Open Font License 1.1；许可见 `vendor/NotoSansSC-LICENSE.txt`。来源：https://github.com/google/fonts/tree/main/ofl/notosanssc （2026-11-22 下载）。由可变字体固定为 400 字重，字形数据按 4 字节对齐以兼容 PDF 子集嵌入；字体完整字符集保留，未删减中文。复现见 `scripts/prepare_pdf_font.py`。

以上组件和字体均嵌入 HTML，点名 PDF 离线生成，无 CDN 或名单上传请求。PDF 仅嵌入实际使用的字形。
