// 配置文件 - 在GitHub Actions中通过环境变量注入
window.APP_CONFIG = {
    GITHUB_REPO: '${{ secrets.REPO_NAME }}',
    GH_TOKEN: '${{ secrets.GH_TOKEN }}',
    BRANCH: 'main',
    FILES_DIR: 'files/'
};

// 如果环境变量未注入，则使用默认值（用于本地开发）
if (window.APP_CONFIG.GITHUB_REPO === '${{ secrets.REPO_NAME }}') {
    window.APP_CONFIG.GITHUB_REPO = 'username/repo'; // 替换为你的GitHub仓库名
}

if (window.APP_CONFIG.GH_TOKEN === '${{ secrets.GH_TOKEN }}') {
    window.APP_CONFIG.GH_TOKEN = ''; // 本地开发时留空或使用自己的token
}