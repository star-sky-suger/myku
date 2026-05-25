const GITHUB_REPO = window.APP_CONFIG?.GITHUB_REPO || 'star-sky-suger/myku';
const BRANCH = window.APP_CONFIG?.BRANCH || 'main';
const FILES_DIR = window.APP_CONFIG?.FILES_DIR || 'files/';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

let allFiles = [];

document.addEventListener('DOMContentLoaded', function() {
  console.log('App loaded. GITHUB_REPO:', GITHUB_REPO);
  
  // 文件选择按钮
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');
  const uploadArea = document.getElementById('uploadArea');
  
  uploadBtn.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Upload button clicked');
    fileInput.click();
  });
  
  // 文件选择处理
  fileInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    console.log('Files selected:', files.length);
    if (files.length > 0) {
      handleFiles(files);
    }
    e.target.value = '';
  });
  
  // 拖拽事件
  uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    console.log('Files dropped:', files.length);
    if (files.length > 0) {
      handleFiles(files);
    }
  });
  
  // 点击上传区域（非按钮）
  uploadArea.addEventListener('click', function(e) {
    if (e.target.id !== 'uploadBtn' && !e.target.classList.contains('upload-btn')) {
      console.log('Upload area clicked');
      fileInput.click();
    }
  });
  
  // 全局阻止默认拖拽行为
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
  });
  
  document.addEventListener('drop', function(e) {
    e.preventDefault();
  });
  
  // 搜索功能
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      filterFiles(e.target.value);
    });
  }
  
  // 关闭模态框
  document.getElementById('closeModal').addEventListener('click', closePreviewModal);
  document.getElementById('previewModal').addEventListener('click', function(e) {
    if (e.target === document.getElementById('previewModal')) {
      closePreviewModal();
    }
  });
  
  // 加载文件列表
  loadFiles();
});

async function handleFiles(files) {
  const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
  if (oversized.length > 0) {
    alert('以下文件超过100MB限制：\n' + oversized.map(f => f.name).join('\n'));
    files = files.filter(f => f.size <= MAX_FILE_SIZE);
  }
  
  if (files.length === 0) return;
  
  showProgress();
  
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  let uploadedSize = 0;
  
  for (const file of files) {
    try {
      await uploadFile(file);
      uploadedSize += file.size;
      updateProgress(uploadedSize, totalSize);
    } catch (err) {
      console.error('Upload error:', err);
      alert('上传失败: ' + err.message);
    }
  }
  
  hideProgress();
  await sleep(2000);
  loadFiles();
}

async function uploadFile(file) {
  const filename = Date.now() + '-' + file.name;
  const content = await readFileAsBase64(file);
  
  const response = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/dispatches', {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      event_type: 'file-upload',
      client_payload: { filename, content }
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'HTTP ' + response.status);
  }
}

async function deleteFile(file) {
  if (!confirm('确定删除 "' + file.name.replace(/^\d+-/, '') + '"?')) return;
  
  const response = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/dispatches', {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      event_type: 'file-delete',
      client_payload: { filename: file.name }
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'HTTP ' + response.status);
  }
  
  alert('删除请求已提交');
  await sleep(2000);
  loadFiles();
}

function readFileAsBase64(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function() {
      resolve(reader.result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showProgress() {
  document.getElementById('uploadProgress').innerHTML = `
    <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
    <div class="progress-text">上传中...</div>
  `;
  document.getElementById('uploadProgress').style.display = 'block';
}

function updateProgress(uploaded, total) {
  const pct = Math.round((uploaded / total) * 100);
  document.querySelector('.progress-fill').style.width = pct + '%';
  document.querySelector('.progress-text').textContent = 
    '已上传 ' + formatFileSize(uploaded) + ' / ' + formatFileSize(total);
}

function hideProgress() {
  document.getElementById('uploadProgress').style.display = 'none';
}

async function loadFiles() {
  const container = document.getElementById('filesContainer');
  container.innerHTML = '<div class="loading">加载中...</div>';
  
  try {
    const response = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + FILES_DIR);
    if (response.status === 404) {
      container.innerHTML = '<div class="empty-state">暂无文件</div>';
      return;
    }
    if (!response.ok) throw new Error('Failed to load files');
    
    let files = await response.json();
    files = files.filter(f => f.type === 'file');
    files.sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified));
    allFiles = files;
    
    displayFiles(files);
  } catch (err) {
    container.innerHTML = '<div class="empty-state">加载失败: ' + err.message + '</div>';
  }
}

function displayFiles(files) {
  const container = document.getElementById('filesContainer');
  
  if (!files || files.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无文件</div>';
    return;
  }
  
  container.innerHTML = files.map(function(file) {
    const size = formatFileSize(file.size);
    const type = getFileType(file.name);
    const icon = getFileIcon(type);
    const name = file.name.replace(/^\d+-/, '');
    const date = file.last_modified ? formatDate(file.last_modified) : '';
    
    return `
      <div class="file-card">
        <div class="file-icon">${icon}</div>
        <div class="file-name" title="${name}">${name}</div>
        <div class="file-info">${size} · ${type}</div>
        ${date ? '<div class="file-date">' + date + '</div>' : ''}
        <div class="file-actions">
          <button class="action-btn preview-btn" onclick="previewFile(${JSON.stringify(file)})">预览</button>
          <button class="action-btn download-btn" onclick="downloadFile(${JSON.stringify(file)})">下载</button>
          <button class="action-btn delete-btn" onclick="deleteFile(${JSON.stringify(file)})">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterFiles(query) {
  if (!query.trim()) {
    displayFiles(allFiles);
    return;
  }
  
  const filtered = allFiles.filter(function(f) {
    return f.name.toLowerCase().includes(query.toLowerCase());
  });
  displayFiles(filtered);
}

function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    jpg:'图片', jpeg:'图片', png:'图片', gif:'图片', webp:'图片', bmp:'图片',
    pdf:'PDF', doc:'Word', docx:'Word',
    xls:'Excel', xlsx:'Excel', ppt:'PPT', pptx:'PPT',
    txt:'文本', zip:'压缩', rar:'压缩', 7z:'压缩',
    mp4:'视频', webm:'视频', ogg:'视频',
    mp3:'音频', wav:'音频', ogg:'音频',
    json:'JSON', html:'HTML', css:'CSS', js:'JS'
  };
  return map[ext] || '其他';
}

function getFileIcon(type) {
  const map = {
    '图片':'🖼️', 'PDF':'📕', 'Word':'📘', 'Excel':'📗',
    'PPT':'📙', '文本':'📄', '压缩':'📦', '视频':'🎬',
    '音频':'🎵', 'JSON':'📋', 'HTML':'🌐', 'CSS':'🎨', 'JS':'💻'
  };
  return map[type] || '📄';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function previewFile(file) {
  const name = file.name.replace(/^\d+-/, '');
  document.getElementById('previewTitle').textContent = name;
  document.getElementById('downloadLink').href = file.download_url;
  document.getElementById('downloadLink').download = name;
  
  const ext = file.name.split('.').pop().toLowerCase();
  let html = '';
  
  if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) {
    html = '<img src="' + file.download_url + '" style="max-width:100%;max-height:60vh;display:block;margin:0 auto">';
  } else if (ext === 'pdf') {
    html = '<iframe src="https://mozilla.github.io/pdf.js/web/viewer.html?file=' + encodeURIComponent(file.download_url) + '" style="width:100%;height:60vh;border:0"></iframe>';
  } else if (['mp4','webm','ogg'].includes(ext)) {
    html = '<video controls src="' + file.download_url + '" style="max-width:100%;max-height:60vh;display:block;margin:0 auto"></video>';
  } else if (['mp3','wav','ogg'].includes(ext)) {
    html = '<audio controls src="' + file.download_url + '" style="width:100%">您的浏览器不支持音频播放功能';
  } else if (['txt','json','html','css','js'].includes(ext)) {
    fetch(file.download_url).then(function(r) {
      return r.text();
    }).then(function(text) {
      document.getElementById('previewBody').innerHTML = '<pre style="background:#f5f5f5;padding:1rem;border-radius:4px;white-space:pre-wrap;word-break:break-all">' + escapeHtml(text) + '</pre>';
    }).catch(function() {
      document.getElementById('previewBody').innerHTML = '<div class="no-preview">无法预览文件内容</div>';
    });
    document.getElementById('previewModal').style.display = 'block';
    return;
  } else {
    html = '<div class="no-preview">暂不支持预览此文件类型</div>';
  }
  
  document.getElementById('previewBody').innerHTML = html;
  document.getElementById('previewModal').style.display = 'block';
}

function closePreviewModal() {
  document.getElementById('previewModal').style.display = 'none';
  document.getElementById('previewBody').innerHTML = '';
}

function downloadFile(file) {
  const a = document.createElement('a');
  a.href = file.download_url;
  a.download = file.name.replace(/^\d+-/, '');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function sleep(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}