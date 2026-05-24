const GITHUB_REPO = window.APP_CONFIG?.GITHUB_REPO || 'star-sky-suger/myku';
const BRANCH = window.APP_CONFIG?.BRANCH || 'main';
const FILES_DIR = window.APP_CONFIG?.FILES_DIR || 'files/';

// DOM 元素
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

document.addEventListener('DOMContentLoaded', () => {
    loadFiles();
    setupEventListeners();
});

function setupEventListeners() {
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', handleFileSelect);

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

    uploadArea.addEventListener('click', (e) => {
        if (e.target !== uploadBtn) fileInput.click();
    });

    closeModal.addEventListener('click', closePreviewModal);
    window.addEventListener('click', (e) => {
        if (e.target === previewModal) closePreviewModal();
    });
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    uploadFiles(files);
    e.target.value = '';
}

// 多文件上传
async function uploadFiles(files) {
    if (!files.length) return;
    showProgress();
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    let uploadedSize = 0;

    for (const file of files) {
        try {
            await triggerWorkflow('file-upload', file);
            uploadedSize += file.size;
            updateProgress(uploadedSize, totalSize);
        } catch (err) {
            console.error('上传失败', err);
            alert(`文件 ${file.name} 上传失败：${err.message}`);
        }
    }

    hideProgress();
    await sleep(3000); // 等待 Actions 执行完成
    await loadFiles();
}

// 删除文件
async function deleteFile(file) {
    if (!confirm(`确定删除文件「${file.name.replace(/^\d+-/, '')}」吗？`)) return;
    try {
        await triggerWorkflow('file-delete', file);
        alert('删除请求已提交，稍等几秒刷新即可');
        await sleep(3000);
        await loadFiles();
    } catch (err) {
        alert(`删除失败：${err.message}`);
    }
}

// 触发 GitHub Actions workflow_dispatch
async function triggerWorkflow(actionType, file) {
    const repo = GITHUB_REPO;
    const filename = file ? `${Date.now()}-${file.name}` : '';
    const content = file ? await readFileAsBase64(file) : '';

    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/file-operations.yml/dispatches`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ref: BRANCH,
            inputs: {
                action: actionType,
                filename: filename,
                content: content
            }
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || '触发工作流失败');
    }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showProgress() {
    uploadProgress.innerHTML = `
        <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
        <div class="progress-text">正在上传...</div>
    `;
    uploadProgress.style.display = 'block';
}

function updateProgress(uploaded, total) {
    const pct = total === 0 ? 100 : Math.round((uploaded / total) * 100);
    uploadProgress.querySelector('.progress-fill').style.width = `${pct}%`;
    uploadProgress.querySelector('.progress-text').textContent = `已上传 ${formatFileSize(uploaded)} / ${formatFileSize(total)}`;
}

function hideProgress() {
    uploadProgress.style.display = 'none';
}

// 加载文件列表（所有设备共享同一个仓库文件）
async function loadFiles() {
    filesContainer.innerHTML = '<div class="loading">加载中...</div>';
    try {
        const files = await getFilesListFromAPI();
        displayFiles(files);
    } catch (err) {
        console.error('加载失败', err);
        filesContainer.innerHTML = `
            <div class="empty-state">
                <p>无法加载文件列表：${err.message}</p>
                <button class="upload-btn" onclick="loadFiles()">重试</button>
            </div>
        `;
    }
}

async function getFilesListFromAPI() {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILES_DIR}?ref=${BRANCH}`;
    const res = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error('获取文件列表失败');
    return await res.json();
}

function displayFiles(files) {
    if (!files || !files.length) {
        filesContainer.innerHTML = '<div class="empty-state">暂无文件，点击上传或拖拽文件到这里</div>';
        return;
    }
    filesContainer.innerHTML = files.map(f => createFileCard(f)).join('');

    document.querySelectorAll('.preview-btn').forEach((btn, i) => {
        btn.onclick = e => { e.stopPropagation(); previewFile(files[i]); };
    });
    document.querySelectorAll('.download-btn').forEach((btn, i) => {
        btn.onclick = e => { e.stopPropagation(); downloadFile(files[i]); };
    });
    document.querySelectorAll('.delete-btn').forEach((btn, i) => {
        btn.onclick = e => { e.stopPropagation(); deleteFile(files[i]); };
    });
}

function createFileCard(file) {
    const size = formatFileSize(file.size);
    const type = getFileType(file.name);
    const icon = getFileIcon(type);
    const name = file.name.replace(/^\d+-/, '');
    return `
        <div class="file-card">
            <div class="file-icon">${icon}</div>
            <div class="file-name" title="${name}">${name}</div>
            <div class="file-info">${size} · ${type}</div>
            <div class="file-actions">
                <button class="action-btn preview-btn">预览</button>
                <button class="action-btn download-btn">下载</button>
                <button class="action-btn delete-btn">删除</button>
            </div>
        </div>
    `;
}

function getFileType(n) {
    const ext = n.split('.').pop().toLowerCase();
    const map = {
        jpg:'图片',jpeg:'图片',png:'图片',gif:'图片',webp:'图片',
        pdf:'PDF文档',doc:'Word文档',docx:'Word文档',
        xls:'Excel表格',xlsx:'Excel表格',ppt:'PPT演示',pptx:'PPT演示',
        txt:'文本文件',zip:'压缩文件',rar:'压缩文件',
        mp4:'视频',webm:'视频',mp3:'音频',wav:'音频',
        json:'JSON文件',html:'HTML文件',css:'CSS文件',js:'JavaScript文件'
    };
    return map[ext] || '其他文件';
}

function getFileIcon(t) {
    const map = {
        '图片':'🖼️','PDF文档':'📕','Word文档':'📘','Excel表格':'📗',
        'PPT演示':'📙','文本文件':'📄','压缩文件':'📦','视频':'🎬',
        '音频':'🎵','JSON文件':'📋','HTML文件':'🌐','CSS文件':'🎨','JavaScript文件':'💻'
    };
    return map[t] || '📄';
}

function formatFileSize(b) {
    if (b===0) return '0 B';
    const k=1024, s=['B','KB','MB','GB'];
    const i=Math.floor(Math.log(b)/Math.log(k));
    return (b/Math.pow(k,i)).toFixed(2)+' '+s[i];
}

// 预览文件
async function previewFile(file) {
    const name = file.name.replace(/^\d+-/, '');
    previewTitle.textContent = name;
    downloadLink.href = file.download_url;
    downloadLink.download = name;
    const ext = file.name.split('.').pop().toLowerCase();
    let html = '';

    if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
        html = `<img src="${file.download_url}" alt="${name}" style="max-width:100%;max-height:60vh">`;
    } else if (ext==='pdf') {
        html = `<iframe src="https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(file.download_url)}" style="width:100%;height:60vh;border:0"></iframe>`;
    } else if (['mp4','webm'].includes(ext)) {
        html = `<video controls src="${file.download_url}" style="max-width:100%;max-height:60vh"></video>`;
    } else if (['mp3','wav'].includes(ext)) {
        html = `<audio controls src="${file.download_url}">`;
    } else if (['txt','json','html','css','js'].includes(ext)) {
        const r=await fetch(file.download_url);
        const t=await r.text();
        html = `<pre style="white-space:pre-wrap;word-break:break-all;max-height:60vh;overflow:auto;background:#f5f5f5;padding:1rem;border-radius:4px">${escapeHtml(t)}</pre>`;
    } else {
        html = '<div class="no-preview">暂不支持预览，请直接下载查看</div>';
    }
    previewBody.innerHTML=html;
    previewModal.style.display='block';
}

function closePreviewModal() {
    previewModal.style.display='none';
    previewBody.innerHTML='';
}

// 下载文件
function downloadFile(file) {
    const a=document.createElement('a');
    a.href=file.download_url;
    a.download=file.name.replace(/^\d+-/,'');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
function escapeHtml(t) {
    const d=document.createElement('div');
    d.textContent=t;
    return d.innerHTML;
}