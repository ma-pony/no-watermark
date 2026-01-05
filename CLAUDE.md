# No Watermark Tool - 项目信息

## 项目概述

纯前端在线水印去除工具，支持多种文件格式的水印处理。所有处理均在浏览器本地完成，无需后端服务器。

## 技术栈

- **前端框架**: Vite 5.0
- **语言**: 原生 JavaScript (ES6+, 模块化)
- **样式**: 原生 CSS
- **核心库**:
  - `file-saver`: 文件下载
  - `jszip`: PPT/PPTX 文件处理
  - `pdf-lib`: PDF 文件处理

## 功能模块

### 1. 图片水印去除
- **文件**: `main.js` (行 44-293)
- **功能**:
  - 修复算法：基于周围像素的智能填充
  - 裁剪去除：裁剪包含水印的区域
  - 模糊处理：对水印区域模糊化
- **交互**: 鼠标框选水印区域

### 2. 视频水印去除
- **文件**: `main.js` (行 295-379)
- **功能**: 可视化选择水印区域
- **限制**: 受浏览器性能限制，大型视频建议使用专业工具

### 3. PPT 水印去除
- **文件**: `main.js` (行 381-529)
- **功能**:
  - 删除文字水印
  - 删除图片水印
  - 删除背景水印
- **实现**: 基于 JSZip 解析 PPTX (ZIP格式)

### 4. Gamma PPT 专用去水印
- **文件**: `main.js` (行 531-819)
- **功能**: 自动删除 "Made with Gamma" 水印
- **实现原理**:
  1. 解析 PPTX 文件 (ZIP格式)
  2. 处理 `ppt/slideLayouts/slideLayout*.xml` 文件
  3. 移除包含 Gamma 特征的图片元素
  4. 处理 `_rels/*.xml.rels` 文件，移除 gamma.app 链接
- **关键函数**:
  - `removeGammaFromLayout()`: 移除布局中的水印元素
  - `removeGammaFromRels()`: 移除 Gamma 超链接关系
  - `processGammaPptx()`: 主处理流程

### 5. PDF 水印去除
- **文件**: `main.js` (行 821-946)
- **功能**:
  - 删除文字水印
  - 删除图片水印
  - 删除背景水印
- **实现**: 基于 pdf-lib 库

## 项目结构

```
no-watermark/
├── index.html          # 主页面 (包含 SEO 优化)
├── style.css           # 样式文件
├── main.js             # 核心逻辑
├── package.json        # 项目配置
├── vite.config.js      # Vite 配置
├── public/             # 静态资源
│   ├── robots.txt      # 搜索引擎爬虫规则
│   ├── sitemap.xml     # 站点地图
│   └── site.webmanifest # PWA 清单
├── README.md           # 项目说明
└── .gitignore          # Git 忽略规则
```

## 全局状态管理

```javascript
const state = {
  currentTab: 'image',
  imageFile: null,
  imageOriginalData: null,
  videoFile: null,
  watermarkRegion: { x: 0, y: 0, width: 100, height: 50 },
  pptFile: null,
  pptSlides: [],
  gammaFile: null,
  gammaLog: [],
  pdfFile: null,
  pdfDoc: null,
  pdfPages: []
};
```

## 命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## SEO 优化

- 完整的 Meta 标签 (title, description, keywords)
- Open Graph / Facebook 分享优化
- Twitter Cards 优化
- Schema.org 结构化数据
- robots.txt 和 sitemap.xml
- FAQ 常见问题区域
- 语义化 HTML

## 部署前检查清单

- [ ] 更新 canonical URL 为实际域名
- [ ] 更新 Open Graph 和 Twitter 图片链接
- [ ] 更新 sitemap.xml 中的 lastmod 日期
- [ ] 创建并添加 favicon 图标文件
- [ ] 根据需要调整 robots.txt
- [ ] 验证结构化数据

## 注意事项

1. **纯前端处理**: 所有文件处理在浏览器本地完成，确保隐私安全
2. **视频处理限制**: 大型视频建议使用 FFmpeg 等专业工具
3. **PPT 处理**: 基于 XML 解析，复杂水印可能需要手动调整
4. **图片修复**: 为简化算法，复杂场景效果有限

## GitHub 仓库

- **仓库**: git@github.com:ma-pony/no-watermark.git
- **当前分支**: vk/1aae-ppt
- **主分支**: main

## 开发规范

1. 保持纯前端实现，不引入后端依赖
2. 所有用户交互都应有清晰的反馈
3. 错误处理要完善，提供友好的错误提示
4. 代码风格保持一致，使用 ES6+ 语法
5. 新增功能需同步更新 SEO 相关内容

## 许可证

MIT
