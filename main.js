import { saveAs } from 'file-saver';
import JSZip from 'jszip';

// ==================== 全局状态 ====================
const state = {
  currentTab: 'image',
  imageFile: null,
  imageOriginalData: null,
  videoFile: null,
  watermarkRegion: { x: 0, y: 0, width: 100, height: 50 },
  pptFile: null,
  pptSlides: []
};

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

console.log('水印去除工具已加载');
