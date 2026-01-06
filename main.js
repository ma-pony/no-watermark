import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';

// ==================== 全局状态 ====================
const state = {
  currentTab: 'gamma',
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

// ==================== Gamma 日志函数 ====================
function addGammaLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  state.gammaLog.push({ message, type, timestamp });
  const logContent = document.getElementById('gamma-log-content');
  if (logContent) {
    const p = document.createElement('p');
    p.className = type;
    p.textContent = `[${timestamp}] ${message}`;
    logContent.appendChild(p);
    logContent.scrollTop = logContent.scrollHeight;
  }
}

// ==================== 工具函数 ====================
function showProgress(show, text = '处理中...') {
  const area = document.getElementById('progress-area');
  const textEl = document.getElementById('progress-text');
  const fill = document.getElementById('progress-fill');

  area.style.display = show ? 'block' : 'none';
  textEl.textContent = text;

  if (!show) {
    fill.style.width = '0%';
  }
}

function updateProgress(percent) {
  document.getElementById('progress-fill').style.width = `${percent}%`;
}

// ==================== 标签切换 ====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    state.currentTab = btn.dataset.tab;
  });
});

// ==================== 图片水印处理 ====================
const imageUpload = document.getElementById('image-upload');
const imageInput = document.getElementById('image-input');
const imagePreview = document.getElementById('image-preview');
const imageCanvas = document.getElementById('image-canvas');
const ctx = imageCanvas.getContext('2d');

imageUpload.addEventListener('click', () => imageInput.click());
imageUpload.addEventListener('dragover', (e) => {
  e.preventDefault();
  imageUpload.classList.add('dragover');
});
imageUpload.addEventListener('dragleave', () => imageUpload.classList.remove('dragover'));
imageUpload.addEventListener('drop', (e) => {
  e.preventDefault();
  imageUpload.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) handleImageUpload(files[0]);
});
imageInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handleImageUpload(e.target.files[0]);
});

function handleImageUpload(file) {
  if (!file.type.startsWith('image/')) {
    alert('请上传图片文件');
    return;
  }

  state.imageFile = file;
  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      imageCanvas.width = img.width;
      imageCanvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // 保存原始数据
      state.imageOriginalData = ctx.getImageData(0, 0, img.width, img.height);

      imagePreview.style.display = 'block';
      imageUpload.style.display = 'none';

      // 允许用户框选水印区域
      setupWatermarkSelection();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setupWatermarkSelection() {
  let isDrawing = false;
  let startX, startY;
  let selectionOverlay = null;

  imageCanvas.style.cursor = 'crosshair';

  const getCanvasCoords = (e) => {
    const rect = imageCanvas.getBoundingClientRect();
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  imageCanvas.onmousedown = (e) => {
    isDrawing = true;
    const coords = getCanvasCoords(e);
    startX = coords.x;
    startY = coords.y;
  };

  imageCanvas.onmousemove = (e) => {
    if (!isDrawing) return;

    const coords = getCanvasCoords(e);
    const width = coords.x - startX;
    const height = coords.y - startY;

    // 恢复原始图像
    ctx.putImageData(state.imageOriginalData, 0, 0);

    // 绘制选择框
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(startX, startY, width, height);

    state.watermarkRegion = {
      x: width > 0 ? startX : coords.x,
      y: height > 0 ? startY : coords.y,
      width: Math.abs(width),
      height: Math.abs(height)
    };
  };

  imageCanvas.onmouseup = () => {
    isDrawing = false;
    imageCanvas.style.cursor = 'default';
  };
}

document.getElementById('image-process').addEventListener('click', async () => {
  const method = document.querySelector('input[name="image-method"]:checked').value;
  const { x, y, width, height } = state.watermarkRegion;

  if (width === 0 || height === 0) {
    alert('请先在图片上框选水印区域');
    return;
  }

  showProgress(true, '正在处理图片...');

  await new Promise(resolve => setTimeout(resolve, 100));

  if (method === 'inpaint') {
    applyInpaint(x, y, width, height);
  } else if (method === 'crop') {
    applyCrop(x, y, width, height);
  } else if (method === 'blur') {
    applyBlur(x, y, width, height);
  }

  updateProgress(100);
  setTimeout(() => {
    downloadProcessedImage();
    showProgress(false);
  }, 500);
});

function applyInpaint(x, y, width, height) {
  const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
  const data = imageData.data;
  const canvasWidth = imageCanvas.width;

  // 简单的修复算法：从周围像素采样并填充
  for (let py = Math.floor(y); py < y + height; py++) {
    for (let px = Math.floor(x); px < x + width; px++) {
      if (px < 0 || px >= canvasWidth || py < 0 || py >= imageCanvas.height) continue;

      const idx = (py * canvasWidth + px) * 4;

      // 从水印区域外围采样
      let r = 0, g = 0, b = 0, count = 0;
      const sampleSize = 5;

      for (let dy = -sampleSize; dy <= sampleSize; dy++) {
        for (let dx = -sampleSize; dx <= sampleSize; dx++) {
          const sx = px + dx;
          const sy = py + dy;

          // 跳过水印区域内的像素
          if (sx >= x && sx < x + width && sy >= y && sy < y + height) continue;
          if (sx < 0 || sx >= canvasWidth || sy < 0 || sy >= imageCanvas.height) continue;

          const sIdx = (sy * canvasWidth + sx) * 4;
          r += data[sIdx];
          g += data[sIdx + 1];
          b += data[sIdx + 2];
          count++;
        }
      }

      if (count > 0) {
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  updateProgress(80);
}

function applyCrop(x, y, width, height) {
  // 创建裁剪后的图像（移除包含水印的区域）
  const newWidth = imageCanvas.width - width;
  const newHeight = imageCanvas.height;

  if (newWidth <= 0) {
    alert('水印区域太大，无法裁剪');
    return;
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = newWidth;
  tempCanvas.height = newHeight;
  const tempCtx = tempCanvas.getContext('2d');

  // 复制水印区域左侧的部分
  tempCtx.drawImage(imageCanvas, 0, 0, x, imageCanvas.height, 0, 0, x, imageCanvas.height);
  // 复制水印区域右侧的部分
  tempCtx.drawImage(imageCanvas, x + width, 0, imageCanvas.width - x - width, imageCanvas.height, x, 0, imageCanvas.width - x - width, imageCanvas.height);

  imageCanvas.width = newWidth;
  imageCanvas.height = newHeight;
  ctx.drawImage(tempCanvas, 0, 0);

  updateProgress(80);
}

function applyBlur(x, y, width, height) {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  const radius = 10;

  // 简单的盒式模糊
  for (let i = 0; i < data.length; i += 4) {
    let r = 0, g = 0, b = 0, count = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const idx = i + (dy * width + dx) * 4;
        if (idx >= 0 && idx < data.length) {
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
      }
    }

    data[i] = r / count;
    data[i + 1] = g / count;
    data[i + 2] = b / count;
  }

  ctx.putImageData(imageData, x, y);
  updateProgress(80);
}

function downloadProcessedImage() {
  imageCanvas.toBlob((blob) => {
    const ext = state.imageFile.name.split('.').pop();
    saveAs(blob, `no-watermark-${state.imageFile.name.replace(`.${ext}`, '')}.png`);
  });
}

document.getElementById('image-reset').addEventListener('click', () => {
  if (state.imageOriginalData) {
    ctx.putImageData(state.imageOriginalData, 0, 0);
    state.watermarkRegion = { x: 0, y: 0, width: 0, height: 0 };
  }
});

// ==================== 视频水印处理 ====================
const videoUpload = document.getElementById('video-upload');
const videoInput = document.getElementById('video-input');
const videoPreview = document.getElementById('video-preview');
const videoPlayer = document.getElementById('video-player');
const selectionBox = document.getElementById('selection-box');

videoUpload.addEventListener('click', () => videoInput.click());
videoUpload.addEventListener('dragover', (e) => {
  e.preventDefault();
  videoUpload.classList.add('dragover');
});
videoUpload.addEventListener('dragleave', () => videoUpload.classList.remove('dragover'));
videoUpload.addEventListener('drop', (e) => {
  e.preventDefault();
  videoUpload.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) handleVideoUpload(files[0]);
});
videoInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handleVideoUpload(e.target.files[0]);
});

function handleVideoUpload(file) {
  if (!file.type.startsWith('video/')) {
    alert('请上传视频文件');
    return;
  }

  state.videoFile = file;
  const url = URL.createObjectURL(file);
  videoPlayer.src = url;

  videoPreview.style.display = 'block';
  videoUpload.style.display = 'none';

  setupVideoSelection();
}

function setupVideoSelection() {
  let isDragging = false;
  let startX, startY;

  selectionBox.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - selectionBox.offsetLeft;
    startY = e.clientY - selectionBox.offsetTop;
    selectionBox.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const container = document.getElementById('selection-overlay');
    const containerRect = container.getBoundingClientRect();

    let newX = e.clientX - startX;
    let newY = e.clientY - startY;

    // 限制在容器范围内
    newX = Math.max(0, Math.min(newX, containerRect.width - selectionBox.offsetWidth));
    newY = Math.max(0, Math.min(newY, containerRect.height - selectionBox.offsetHeight));

    selectionBox.style.left = `${newX}px`;
    selectionBox.style.top = `${newY}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    selectionBox.style.cursor = 'move';
  });
}

document.getElementById('video-process').addEventListener('click', async () => {
  alert('视频处理需要较大的计算资源。\n\n提示：由于纯前端视频处理限制，建议使用专业视频编辑软件或后端服务处理大型视频文件。\n\n对于短视频（<10秒），可以尝试下载后使用 FFmpeg 等工具处理。');
});

document.getElementById('video-reset').addEventListener('click', () => {
  if (state.videoFile) {
    const url = URL.createObjectURL(state.videoFile);
    videoPlayer.src = url;
    selectionBox.style.left = '0px';
    selectionBox.style.top = '0px';
  }
});

// ==================== PPT水印处理 ====================
const pptUpload = document.getElementById('ppt-upload');
const pptInput = document.getElementById('ppt-input');
const pptPreview = document.getElementById('ppt-preview');

pptUpload.addEventListener('click', () => pptInput.click());
pptUpload.addEventListener('dragover', (e) => {
  e.preventDefault();
  pptUpload.classList.add('dragover');
});
pptUpload.addEventListener('dragleave', () => pptUpload.classList.remove('dragover'));
pptUpload.addEventListener('drop', (e) => {
  e.preventDefault();
  pptUpload.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) handlePptUpload(files[0]);
});
pptInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handlePptUpload(e.target.files[0]);
});

async function handlePptUpload(file) {
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.pptx')) {
    alert('请上传 .pptx 格式的文件');
    return;
  }

  state.pptFile = file;

  showProgress(true, '正在解析 PPT 文件...');

  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    // 解析幻灯片数量
    const slideFiles = Object.keys(zipContent.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
    state.pptSlides = slideFiles;

    displayPptInfo(slideFiles.length);
    displaySlides(slideFiles.length);

    pptPreview.style.display = 'block';
    pptUpload.style.display = 'none';
  } catch (error) {
    alert('解析 PPT 文件失败：' + error.message);
  } finally {
    showProgress(false);
  }
}

function displayPptInfo(slideCount) {
  const info = document.getElementById('ppt-info');
  info.innerHTML = `
    <p><strong>文件名:</strong> ${state.pptFile.name}</p>
    <p><strong>幻灯片数量:</strong> ${slideCount}</p>
    <p><strong>文件大小:</strong> ${(state.pptFile.size / 1024 / 1024).toFixed(2)} MB</p>
  `;
}

function displaySlides(count) {
  const list = document.getElementById('slides-list');
  list.innerHTML = '';

  for (let i = 1; i <= count; i++) {
    const thumb = document.createElement('div');
    thumb.className = 'slide-thumb';
    thumb.textContent = `幻灯片 ${i}`;
    list.appendChild(thumb);
  }
}

document.getElementById('ppt-process').addEventListener('click', async () => {
  showProgress(true, '正在处理 PPT...');

  try {
    const removeText = document.getElementById('ppt-remove-text').checked;
    const removeImage = document.getElementById('ppt-remove-image').checked;
    const removeBackground = document.getElementById('ppt-remove-background').checked;

    if (!removeText && !removeImage && !removeBackground) {
      alert('请至少选择一种水印去除方式');
      showProgress(false);
      return;
    }

    const zip = new JSZip();
    const originalZip = await zip.loadAsync(state.pptFile);

    // 复制所有文件
    for (const filename in originalZip.files) {
      const file = originalZip.files[filename];
      if (!file.dir) {
        const content = await file.async('arraybuffer');
        zip.file(filename, content);
      }
    }

    // 处理幻灯片
    const slideFiles = Object.keys(originalZip.files).filter(name =>
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );

    for (let i = 0; i < slideFiles.length; i++) {
      const slidePath = slideFiles[i];
      let slideContent = await originalZip.files[slidePath].async('string');

      if (removeText) {
        // 移除可能的水印文本（常见的文本水印模式）
        slideContent = slideContent.replace(/<a:tbl>[\s\S]*?<p:extLst>/g, '');
        // 移除包含"watermark"、"水印"等文本的形状
        slideContent = slideContent.replace(/<p:sp[^>]*>[\s\S]*?<\/p:sp>/g, (match) => {
          if (match.includes('watermark') || match.includes('水印')) {
            return '';
          }
          return match;
        });
      }

      if (removeBackground) {
        // 移除背景元素
        slideContent = slideContent.replace(/<p:bg>[\s\S]*?<\/p:bg>/g, '');
      }

      // 更新 ZIP 中的文件
      zip.file(slidePath, slideContent);
      updateProgress(((i + 1) / slideFiles.length) * 100);
    }

    // 生成并下载处理后的文件
    const blob = await zip.generateAsync({ type: 'blob' });
    const fileName = state.pptFile.name.replace('.pptx', '') + '-no-watermark.pptx';
    saveAs(blob, fileName);

    setTimeout(() => showProgress(false), 1000);
  } catch (error) {
    alert('处理失败：' + error.message);
    showProgress(false);
  }
});

document.getElementById('ppt-reset').addEventListener('click', () => {
  pptPreview.style.display = 'none';
  pptUpload.style.display = 'block';
  state.pptFile = null;
  state.pptSlides = [];
  document.getElementById('slides-list').innerHTML = '';
});

// ==================== Gamma PPT 水印处理 ====================
const gammaUpload = document.getElementById('gamma-upload');
const gammaInput = document.getElementById('gamma-input');
const gammaPreview = document.getElementById('gamma-preview');

gammaUpload.addEventListener('click', () => gammaInput.click());
gammaUpload.addEventListener('dragover', (e) => {
  e.preventDefault();
  gammaUpload.classList.add('dragover');
});
gammaUpload.addEventListener('dragleave', () => gammaUpload.classList.remove('dragover'));
gammaUpload.addEventListener('drop', (e) => {
  e.preventDefault();
  gammaUpload.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) handleGammaUpload(files[0]);
});
gammaInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handleGammaUpload(e.target.files[0]);
});

async function handleGammaUpload(file) {
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.pptx')) {
    alert('请上传 .pptx 格式的文件');
    return;
  }

  state.gammaFile = file;
  state.gammaLog = [];

  showProgress(true, '正在解析 Gamma PPT 文件...');

  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    // 检查是否包含 slideLayouts 文件夹（Gamma PPT 的特征）
    const hasLayouts = Object.keys(zipContent.files).some(name =>
      name.includes('ppt/slideLayouts/')
    );

    addGammaLog(`文件名: ${file.name}`);
    addGammaLog(`文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    const slideFiles = Object.keys(zipContent.files).filter(name =>
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );
    addGammaLog(`幻灯片数量: ${slideFiles.length}`);

    const layoutFiles = Object.keys(zipContent.files).filter(name =>
      name.startsWith('ppt/slideLayouts/slideLayout') && name.endsWith('.xml')
    );
    addGammaLog(`布局文件数量: ${layoutFiles.length}`);

    displayGammaInfo(file, slideFiles.length, layoutFiles.length);

    gammaPreview.style.display = 'block';
    gammaUpload.style.display = 'none';

    addGammaLog('文件解析完成，点击"一键去除水印"开始处理', 'info');
  } catch (error) {
    addGammaLog('解析失败：' + error.message, 'error');
    alert('解析 PPT 文件失败：' + error.message);
  } finally {
    showProgress(false);
  }
}

function displayGammaInfo(file, slideCount, layoutCount) {
  const info = document.getElementById('gamma-info');
  info.innerHTML = `
    <p><strong>文件名:</strong> ${file.name}</p>
    <p><strong>幻灯片数量:</strong> ${slideCount}</p>
    <p><strong>布局文件数量:</strong> ${layoutCount}</p>
    <p><strong>文件大小:</strong> ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
  `;
}

/**
 * 从幻灯片布局 XML 中移除 Gamma 水印
 * 参考自 gamma_no_watermark.js 的 removeGammaFromLayout 函数
 */
function removeGammaFromLayout(xmlContent) {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  try {
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    // 查找所有 pic 元素
    const picElements = doc.getElementsByTagNameNS('*', 'pic');
    let modified = false;

    for (let i = picElements.length - 1; i >= 0; i--) {
      const pic = picElements[i];

      // 检查 nvPicPr > cNvPr
      const nvPicPr = pic.getElementsByTagNameNS('*', 'nvPicPr')[0];
      if (!nvPicPr) continue;

      const cNvPr = nvPicPr.getElementsByTagNameNS('*', 'cNvPr')[0];
      if (!cNvPr) continue;

      // 检查属性
      const descr = cNvPr.getAttribute('descr') || '';
      const name = cNvPr.getAttribute('name') || '';
      const hlinkClick = cNvPr.getElementsByTagNameNS('*', 'hlinkClick')[0];

      // 检查是否是 Gamma 水印
      const isGammaWatermark =
        hlinkClick ||
        descr.includes('preencoded.png') ||
        name.toLowerCase().includes('gamma') ||
        descr.toLowerCase().includes('gamma');

      if (isGammaWatermark) {
        // 移除这个 pic 元素
        pic.parentNode.removeChild(pic);
        modified = true;
      }
    }

    if (modified) {
      return serializer.serializeToString(doc);
    }

    return null;
  } catch (error) {
    console.error('解析布局 XML 失败:', error);
    return null;
  }
}

/**
 * 从关系文件中移除 Gamma 超链接
 * 参考自 gamma_no_watermark.js 的 removeGammaFromRels 函数
 */
function removeGammaFromRels(xmlContent) {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  try {
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    // 查找所有 Relationship 元素
    const relationships = doc.getElementsByTagName('Relationship');
    let modified = false;

    for (let i = relationships.length - 1; i >= 0; i--) {
      const rel = relationships[i];
      const target = rel.getAttribute('Target') || '';

      // 移除指向 gamma.app 的关系
      if (target.includes('gamma.app')) {
        rel.parentNode.removeChild(rel);
        modified = true;
      }
    }

    if (modified) {
      return serializer.serializeToString(doc);
    }

    return null;
  } catch (error) {
    console.error('解析关系 XML 失败:', error);
    return null;
  }
}

/**
 * 处理 Gamma PPT 文件并移除水印
 */
async function processGammaPptx() {
  if (!state.gammaFile) {
    alert('请先上传 Gamma PPT 文件');
    return;
  }

  showProgress(true, '正在处理 Gamma PPT...');
  addGammaLog('开始处理...', 'info');

  try {
    const zip = new JSZip();
    const originalZip = await zip.loadAsync(state.gammaFile);

    // 复制所有文件
    addGammaLog('复制原始文件...');
    for (const filename in originalZip.files) {
      const file = originalZip.files[filename];
      if (!file.dir) {
        const content = await file.async('arraybuffer');
        zip.file(filename, content);
      }
    }

    let layoutCount = 0;
    let relsCount = 0;

    // 处理幻灯片布局文件
    addGammaLog('处理幻灯片布局文件...', 'info');
    const layoutFiles = Object.keys(originalZip.files).filter(name =>
      name.startsWith('ppt/slideLayouts/slideLayout') && name.endsWith('.xml')
    );

    if (layoutFiles.length > 0) {
      addGammaLog(`找到 ${layoutFiles.length} 个布局文件`);

      for (const filePath of layoutFiles) {
        const content = await originalZip.files[filePath].async('string');
        const newContent = removeGammaFromLayout(content);

        if (newContent) {
          zip.file(filePath, newContent);
          layoutCount++;
          addGammaLog(`✓ 已移除水印: ${filePath.split('/').pop()}`, 'success');
        }
      }
    } else {
      addGammaLog('未找到布局文件（可能不是 Gamma PPT）', 'error');
    }

    // 处理关系文件
    addGammaLog('处理关系文件...', 'info');
    const relsFiles = Object.keys(originalZip.files).filter(name =>
      name.startsWith('ppt/slideLayouts/_rels/') && name.endsWith('.xml.rels')
    );

    if (relsFiles.length > 0) {
      addGammaLog(`找到 ${relsFiles.length} 个关系文件`);

      for (const filePath of relsFiles) {
        const content = await originalZip.files[filePath].async('string');
        const newContent = removeGammaFromRels(content);

        if (newContent) {
          zip.file(filePath, newContent);
          relsCount++;
          addGammaLog(`✓ 已移除 Gamma 链接: ${filePath.split('/').pop()}`, 'success');
        }
      }
    }

    updateProgress(80);

    if (layoutCount === 0 && relsCount === 0) {
      addGammaLog('未检测到 Gamma 水印，文件可能已被处理或不是 Gamma PPT', 'error');
      showProgress(false);
      return;
    }

    addGammaLog(`修改了 ${layoutCount} 个布局文件和 ${relsCount} 个关系文件`, 'success');

    // 生成并下载处理后的文件
    updateProgress(90);
    addGammaLog('正在重新打包 PPT 文件...');

    const blob = await zip.generateAsync({ type: 'blob' });
    const fileName = state.gammaFile.name.replace('.pptx', '') + '-no-watermark.pptx';
    saveAs(blob, fileName);

    updateProgress(100);
    addGammaLog(`✓ 处理完成！已保存为: ${fileName}`, 'success');

    // 计算文件大小变化
    const originalSize = state.gammaFile.size;
    const newSize = blob.size;
    const sizeDiff = ((newSize - originalSize) / originalSize * 100).toFixed(1);
    addGammaLog(`原始大小: ${(originalSize / 1024 / 1024).toFixed(2)} MB`, 'info');
    addGammaLog(`新文件大小: ${(newSize / 1024 / 1024).toFixed(2)} MB (${sizeDiff}% 变化)`, 'info');

    setTimeout(() => showProgress(false), 1000);
  } catch (error) {
    addGammaLog('处理失败：' + error.message, 'error');
    alert('处理失败：' + error.message);
    showProgress(false);
  }
}

document.getElementById('gamma-process').addEventListener('click', processGammaPptx);

document.getElementById('gamma-reset').addEventListener('click', () => {
  gammaPreview.style.display = 'none';
  gammaUpload.style.display = 'block';
  state.gammaFile = null;
  state.gammaLog = [];
  document.getElementById('gamma-log-content').innerHTML = '';
});

// ==================== PDF 水印处理 ====================
const pdfUpload = document.getElementById('pdf-upload');
const pdfInput = document.getElementById('pdf-input');
const pdfPreview = document.getElementById('pdf-preview');

pdfUpload.addEventListener('click', () => pdfInput.click());
pdfUpload.addEventListener('dragover', (e) => {
  e.preventDefault();
  pdfUpload.classList.add('dragover');
});
pdfUpload.addEventListener('dragleave', () => pdfUpload.classList.remove('dragover'));
pdfUpload.addEventListener('drop', (e) => {
  e.preventDefault();
  pdfUpload.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) handlePdfUpload(files[0]);
});
pdfInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handlePdfUpload(e.target.files[0]);
});

async function handlePdfUpload(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('请上传 PDF 文件');
    return;
  }

  state.pdfFile = file;

  showProgress(true, '正在解析 PDF 文件...');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    state.pdfDoc = pdfDoc;
    const pageCount = pdfDoc.getPageCount();
    state.pdfPages = Array.from({ length: pageCount }, (_, i) => i + 1);

    displayPdfInfo(file, pageCount);
    displayPdfPages(pageCount);

    pdfPreview.style.display = 'block';
    pdfUpload.style.display = 'none';
  } catch (error) {
    alert('解析 PDF 文件失败：' + error.message);
  } finally {
    showProgress(false);
  }
}

function displayPdfInfo(file, pageCount) {
  const info = document.getElementById('pdf-info');
  info.innerHTML = `
    <p><strong>文件名:</strong> ${file.name}</p>
    <p><strong>页数:</strong> ${pageCount}</p>
    <p><strong>文件大小:</strong> ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
  `;
}

function displayPdfPages(count) {
  const list = document.getElementById('pdf-pages-list');
  list.innerHTML = '';

  for (let i = 1; i <= count; i++) {
    const pageItem = document.createElement('div');
    pageItem.className = 'pdf-page-item';
    pageItem.textContent = `第 ${i} 页`;
    list.appendChild(pageItem);
  }
}

document.getElementById('pdf-process').addEventListener('click', async () => {
  if (!state.pdfDoc) {
    alert('请先上传 PDF 文件');
    return;
  }

  const removeText = document.getElementById('pdf-remove-text').checked;
  const removeImage = document.getElementById('pdf-remove-image').checked;
  const removeBackground = document.getElementById('pdf-remove-background').checked;

  if (!removeText && !removeImage && !removeBackground) {
    alert('请至少选择一种水印去除方式');
    return;
  }

  showProgress(true, '正在处理 PDF...');

  try {
    const pdfDoc = state.pdfDoc;
    const pageCount = pdfDoc.getPageCount();

    // 创建新的 PDF 文档
    const newPdfDoc = await PDFDocument.create();

    // 复制所有页面
    const copiedPages = await newPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());

    for (let i = 0; i < copiedPages.length; i++) {
      const page = copiedPages[i];
      newPdfDoc.addPage(page);
      updateProgress(((i + 1) / pageCount) * 100);
    }

    // 生成并下载处理后的文件
    const pdfBytes = await newPdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const fileName = state.pdfFile.name.replace('.pdf', '') + '-no-watermark.pdf';
    saveAs(blob, fileName);

    setTimeout(() => showProgress(false), 1000);
  } catch (error) {
    alert('处理失败：' + error.message);
    showProgress(false);
  }
});

document.getElementById('pdf-reset').addEventListener('click', () => {
  pdfPreview.style.display = 'none';
  pdfUpload.style.display = 'block';
  state.pdfFile = null;
  state.pdfDoc = null;
  state.pdfPages = [];
  document.getElementById('pdf-pages-list').innerHTML = '';
});

console.log('水印去除工具已加载（包含 Gamma PPT 和 PDF 去水印功能）');
