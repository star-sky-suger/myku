window.APP_CONFIG = {
    GITHUB_REPO: 'star-sky-suger/myku', // 改成你的仓库
    BRANCH: 'main',
    FILES_DIR: 'files/',
    API_TOKEN: 'your-frontend-token-here', // 前端鉴权TOKEN（需和后端一致）
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 最大文件大小10MB
    ALLOWED_FILE_TYPES: [ // 允许上传的文件类型
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'txt', 'zip', 'rar', 'mp4', 'webm', 'mp3', 'wav',
        'json', 'html', 'css', 'js'
    ]
};