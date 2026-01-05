# 水印去除工具

纯前端在线水印去除工具，支持图片、视频、PPT和Gamma App水印处理。

## 功能特性

- **图片水印去除**
  - 修复算法：基于周围像素的智能填充
  - 裁剪去除：裁剪掉包含水印的区域
  - 模糊处理：对水印区域进行模糊处理

- **视频水印去除**
  - 可视化选择水印区域
  - 区域模糊处理
  - 注意：大型视频建议使用专业工具处理

- **PPT水印去除**
  - 删除文字水印
  - 删除图片水印
  - 删除背景水印

- **Gamma PPT 专用去水印**
  - 自动删除 "Made with Gamma" 水印
  - 删除幻灯片布局中的水印图片
  - 删除指向 gamma.app 的超链接
  - 保留所有原始内容和格式

## 快速开始

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

## 技术栈

- **Vite**: 现代化的前端构建工具
- **FileSaver.js**: 文件下载功能
- **JSZip**: PPT文件处理（ZIP格式）

## 项目结构

```
no-watermark/
├── index.html              # 主页面
├── style.css               # 样式文件
├── main.js                 # 主逻辑
├── package.json            # 项目配置
├── vite.config.js          # Vite 配置
├── public/                 # 静态资源
│   ├── robots.txt          # 爬虫规则
│   ├── sitemap.xml         # 站点地图
│   └── site.webmanifest    # PWA 清单
└── README.md               # 说明文档
```

## 使用说明

### 图片水印去除

1. 切换到"图片水印"标签
2. 上传或拖拽图片
3. 在图片上框选水印区域
4. 选择处理方式（修复/裁剪/模糊）
5. 点击"处理并下载"

### 视频水印去除

1. 切换到"视频水印"标签
2. 上传视频文件
3. 播放视频并拖动红色框选水印位置
4. 点击"处理并下载"

### PPT水印去除

1. 切换到"PPT水印"标签
2. 上传 .pptx 文件
3. 选择要去除的水印类型
4. 点击"处理并下载"

### Gamma PPT 水印去除

1. 切换到"Gamma PPT"标签
2. 上传从 Gamma 导出的 .pptx 文件
3. 点击"一键去除水印"
4. 等待处理完成并自动下载

## SEO 优化

项目已包含完整的 SEO 优化：

- **Meta 标签**: 完整的 title、description、keywords
- **Open Graph**: Facebook/LinkedIn 分享优化
- **Twitter Cards**: Twitter 分享优化
- **结构化数据**: Schema.org JSON-LD 标记
- **语义化 HTML**: 使用正确的 HTML5 语义标签
- **FAQ 区域**: 常见问题有助于搜索排名
- **robots.txt**: 搜索引擎爬虫规则
- **sitemap.xml**: 站点地图便于索引
- **PWA 支持**: Web App Manifest

### 部署前 SEO 检查清单

- [ ] 更新 `canonical` URL 为实际域名
- [ ] 更新 Open Graph 和 Twitter Card 图片链接
- [ ] 更新 sitemap.xml 中的 `lastmod` 日期
- [ ] 创建并添加 favicon 图标文件
- [ ] 根据需要调整 robots.txt
- [ ] 验证结构化数据：https://validator.schema.org/
- [ ] 测试社交分享：https://www.opengraph.xyz/

## 隐私说明

所有文件处理均在浏览器本地完成，不会上传到任何服务器，确保您的数据安全。

## 注意事项

- 视频处理功能受限于浏览器性能，大型视频建议使用 FFmpeg 等专业工具
- PPT处理基于XML解析，复杂水印可能需要手动调整
- 图片修复算法为简化版本，复杂场景效果有限

## 许可证

MIT
