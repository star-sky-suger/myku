// 配置 - 从config.js获取
const GITHUB_REPO = window.APP_CONFIG?.GITHUB_REPO || 'username/repo';
const GH_TOKEN = window.APP_CONFIG?.GH_TOKEN || '';
const BRANCH = window.APP_CONFIG?.BRANCH || 'main';
const FILES_DIR = window.APP_CONFIG?.FILES_DIR || 'files/';

// DOM元素
const uploadArea = document.getElementById('uploadArea');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const filesContainer = document.getElementById('filesContainer');
const previewModal = document.getElementById('previewModal');
const closeModal = document.getElementById('closeModal');
const previewTitle = document.getElementById('previewTitle');
const previewBody = document.getElementById('previewBody');
const downloadLink = document.getElementById('downloadLink');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    validateConfig();
    loadFiles();
    setupEventListeners();
});

// 验证配置
function validateConfig() {
    if (!GH_TOKEN || GH_TOKEN === '') {
        alert('警告：未配置 GH_TOKEN，文件上传功能可能无法正常工作');
    }
    if (!GITHUB_REPO || GITHUB_REPO === 'username/repo') {
        alert('警告：未配置正确的仓库名称');
    }
}

// 设置事件监听
function setupEventListeners() {
    // 点击上传按钮
    uploadBtn.addEventListener('click', () => fileInput.click());
    
    // 文件选择
    fileInput.addEventListener('change', handleFileSelect);
    
    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        uploadFiles(files);
    });
    
    // 点击上传区域
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== uploadBtn && e.target.id !== 'uploadArea') return;
        fileInput.click();
    });
    
    // 关闭模态框
    closeModal.addEventListener('click', closePreviewModal);
    window.addEventListener('click', (e) => {
        if (e.target === previewModal) closePreviewModal();
    });
}

// 处理文件选择
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    uploadFiles(files);
    e.target.value = ''; // 重置input
}

// 上传文件
async function uploadFiles(files) {
    showProgress();
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            await uploadFile(file, i + 1, files.length);
        } catch (error) {
            console.error('上传失败:', error);
            alert(`文件 ${file.name} 上传失败: ${error.message}`);
        }
    }
    
    hideProgress();
    await loadFiles();
}

// 上传单个文件
async function uploadFile(file, index, total) {
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = FILES_DIR + fileName;
    
    // 读取文件内容
    const content = await readFileAsBase64(file);
    
    // 构建API请求
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Upload file: ${fileName}`,
            content: content,
            branch: BRANCH
        })
    });
    
    if (!response.ok) {
        let errorMessage = `上传失败 (HTTP ${response.status})`;
        try {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
        } catch (e) {
            // 如果无法解析JSON，使用状态码作为错误信息
        }
        
        // 针对常见错误提供更详细的提示
        if (errorMessage.includes('Bad credentials')) {
            errorMessage = '认证失败：请检查 GH_TOKEN 是否正确配置，确保 token 具有 repo 权限';
        } else if (errorMessage.includes('Not Found')) {
            errorMessage = '仓库不存在：请检查 GITHUB_REPO 配置是否正确';
        } else if (errorMessage.includes('Forbidden')) {
            errorMessage = '权限不足：请确保 GH_TOKEN 具有 repo 权限';
        }
        
        throw new Error(errorMessage);
    }
    
    updateProgress(index, total);
}

// 读取文件为Base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 显示进度
function showProgress() {
    uploadProgress.innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-text">正在上传...</div>
    `;
    uploadProgress.style.display = 'block';
}

// 更新进度
function updateProgress(current, total) {
    const percentage = (current / total) * 100;
    const progressFill = uploadProgress.querySelector('.progress-fill');
    const progressText = uploadProgress.querySelector('.progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    if (progressText) {
        progressText.textContent = `已上传 ${current}/${total}`;
    }
}

// 隐藏进度
function hideProgress() {
    uploadProgress.style.display = 'none';
}

// 加载文件列表
async function loadFiles() {
    filesContainer.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const files = await getFilesList();
        displayFiles(files);
    } catch (error) {
        console.error('加载文件列表失败:', error);
        filesContainer.innerHTML = '<div class="empty-state">无法加载文件列表</div>';
    }
}

// 获取文件列表
async function getFilesList() {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILES_DIR}?ref=${BRANCH}`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${GH_TOKEN}`
        }
    });
    
    if (!response.ok) {
        if (response.status === 404) {
            // 目录不存在，返回空数组
            return [];
        }
        const error = await response.json();
        throw new Error(error.message || '获取文件列表失败');
    }
    
    return await response.json();
}

// 显示文件列表
function displayFiles(files) {
    if (!files || files.length === 0) {
        filesContainer.innerHTML = '<div class="empty-state">暂无文件，上传一个吧！</div>';
        return;
    }
    
    filesContainer.innerHTML = files.map(file => createFileCard(file)).join('');
    
    // 添加事件监听
    document.querySelectorAll('.file-card').forEach((card, index) => {
        card.addEventListener('click', () => previewFile(files[index]));
    });
    
    document.querySelectorAll('.download-btn').forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadFile(files[index]);
        });
    });
    
    document.querySelectorAll('.preview-btn').forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            previewFile(files[index]);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFile(files[index]);
        });
    });
}

// 创建文件卡片
function createFileCard(file) {
    const fileSize = formatFileSize(file.size);
    const fileType = getFileType(file.name);
    const fileIcon = getFileIcon(fileType);
    
    return `
        <div class="file-card">
            <div class="file-icon">${fileIcon}</div>
            <div class="file-name" title="${file.name.replace(/^\d+-/, '')}">${file.name.replace(/^\d+-/, '')}</div>
            <div class="file-info">${fileSize} · ${fileType}</div>
            <div class="file-actions">
                <button class="action-btn preview-btn">预览</button>
                <button class="action-btn download-btn">下载</button>
                <button class="action-btn delete-btn">删除</button>
            </div>
        </div>
    `;
}

// 获取文件类型
function getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const types = {
        'jpg': '图片', 'jpeg': '图片', 'png': '图片', 'gif': '图片', 'bmp': '图片', 'webp': '图片',
        'pdf': 'PDF文档',
        'doc': 'Word文档', 'docx': 'Word文档',
        'xls': 'Excel表格', 'xlsx': 'Excel表格',
        'ppt': 'PPT演示', 'pptx': 'PPT演示',
        'txt': '文本文件',
        'zip': '压缩文件', 'rar': '压缩文件', '7z': '压缩文件',
        'mp4': '视频', 'webm': '视频', 'ogg': '视频',
        'mp3': '音频', 'wav': '音频', 'ogg': '音频',
        'json': 'JSON文件',
        'html': 'HTML文件',
        'css': 'CSS文件',
        'js': 'JavaScript文件'
    };
    return types[ext] || '其他文件';
}

// 获取文件图标
function getFileIcon(fileType) {
    const icons = {
        '图片': '🖼️',
        'PDF文档': '📕',
        'Word文档': '📘',
        'Excel表格': '📗',
        'PPT演示': '📙',
        '文本文件': '📄',
        '压缩文件': '📦',
        '视频': '🎬',
        '音频': '🎵',
        'JSON文件': '📋',
        'HTML文件': '🌐',
        'CSS文件': '🎨',
        'JavaScript文件': '💻'
    };
    return icons[fileType] || '📄';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 预览文件
async function previewFile(file) {
    previewTitle.textContent = file.name.replace(/^\d+-/, '');
    downloadLink.href = file.download_url;
    downloadLink.download = file.name.replace(/^\d+-/, '');
    
    const fileType = getFileType(file.name);
    const ext = file.name.split('.').pop().toLowerCase();
    
    // 根据文件类型显示不同的预览
    let previewContent = '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
        previewContent = `<img src="${file.download_url}" alt="${file.name}">`;
    } else if (ext === 'pdf') {
        previewContent = `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(file.download_url)}&embedded=true"></iframe>`;
    } else if (['mp4', 'webm', 'ogg'].includes(ext)) {
        previewContent = `<video controls src="${file.download_url}"></video>`;
    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
        previewContent = `<audio controls src="${file.download_url}"></audio>`;
    } else if (['txt', 'json', 'html', 'css', 'js'].includes(ext)) {
        // 获取文本内容
        try {
            const response = await fetch(file.download_url);
            const text = await response.text();
            previewContent = `<pre>${escapeHtml(text)}</pre>`;
        } catch {
            previewContent = '<div class="no-preview">无法预览此文件内容</div>';
        }
    } else {
        previewContent = '<div class="no-preview">暂不支持此文件类型预览</div>';
    }
    
    previewBody.innerHTML = previewContent;
    previewModal.style.display = 'block';
}

// 关闭预览模态框
function closePreviewModal() {
    previewModal.style.display = 'none';
    previewBody.innerHTML = '';
}

// 下载文件
function downloadFile(file) {
    const link = document.createElement('a');
    link.href = file.download_url;
    link.download = file.name.replace(/^\d+-/, '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 删除文件
async function deleteFile(file) {
    if (!confirm(`确定要删除文件 "${file.name.replace(/^\d+-/, '')}" 吗？`)) {
        return;
    }
    
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${file.path}`;
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${GH_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Delete file: ${file.name}`,
                sha: file.sha,
                branch: BRANCH
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '删除失败');
        }
        
        await loadFiles();
        alert('文件已删除');
    } catch (error) {
        console.error('删除失败:', error);
        alert(`删除失败: ${error.message}`);
    }
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 如果是GitHub Pages环境，使用相对URL
if (window.location.hostname.includes('github.io')) {
    // GitHub Pages环境配置
    console.log('Running on GitHub Pages');
}
