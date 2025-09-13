const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const CONFIG = {
    PORT: process.env.PORT || 8000,
    HOST: process.env.HOST || 'localhost',
    EXCLUDED_FOLDERS: ['.git', 'node_modules', '.DS_Store'],
    MIME_TYPES: {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.json': 'application/json'
    }
};

/**
 * 로거 클래스
 */
class Logger {
    static info(message, ...args) {
        console.log(`🔍 ${message}`, ...args);
    }

    static success(message, ...args) {
        console.log(`✅ ${message}`, ...args);
    }

    static error(message, ...args) {
        console.error(`❌ ${message}`, ...args);
    }

    static warn(message, ...args) {
        console.warn(`⚠️  ${message}`, ...args);
    }

    static folder(developerName, projectCount) {
        const emoji = projectCount > 0 ? '📂' : '📁';
        const status = projectCount > 0 
            ? `${projectCount}개 프로젝트 (index.html 포함)`
            : 'index.html이 있는 프로젝트 없음';
        console.log(`${emoji} ${developerName}: ${status}`);
    }
}

/**
 * HTTP 응답 헬퍼 클래스
 */
class ResponseHelper {
    static setCORSHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    static sendJSON(res, data, statusCode = 200) {
        this.setCORSHeaders(res);
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
    }

    static sendError(res, message, statusCode = 500) {
        this.setCORSHeaders(res);
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: message, 
            timestamp: new Date().toISOString() 
        }));
    }

    static send404(res, message = 'File not found') {
        this.sendError(res, message, 404);
    }
}

/**
 * 프로젝트 스캐너 클래스
 */
class ProjectScanner {
    constructor(rootDir) {
        this.rootDir = rootDir;
    }

    /**
     * 2-depth 프로젝트 스캔
     * @returns {Object} 스캔 결과 { projects, developers, stats }
     */
    scan() {
        const projects = [];
        const developers = this.getDeveloperFolders();
        
        for (const developer of developers) {
            const developerProjects = this.scanDeveloperProjects(developer.name);
            projects.push(...developerProjects);
            
            const validProjectCount = developerProjects.length;
            Logger.folder(developer.name, validProjectCount);
        }
        
        return {
            projects,
            developers: developers.map(d => d.name),
            stats: this.generateStats(projects, developers)
        };
    }

    /**
     * 개발자 폴더 목록 조회
     * @returns {Array} 개발자 폴더 배열
     */
    getDeveloperFolders() {
        try {
            const items = fsSync.readdirSync(this.rootDir, { withFileTypes: true });
            return items.filter(item => 
                item.isDirectory() && 
                !this.isExcludedFolder(item.name)
            );
        } catch (error) {
            Logger.error('개발자 폴더 조회 실패:', error.message);
            return [];
        }
    }

    /**
     * 특정 개발자의 프로젝트 스캔
     * @param {string} developerName - 개발자명
     * @returns {Array} 프로젝트 배열
     */
    scanDeveloperProjects(developerName) {
        const projects = [];
        const developerPath = path.join(this.rootDir, developerName);
        
        try {
            const projectFolders = fsSync.readdirSync(developerPath, { withFileTypes: true })
                .filter(item => item.isDirectory() && !this.isExcludedFolder(item.name));
            
            for (const projectFolder of projectFolders) {
                const projectPath = path.join(developerPath, projectFolder.name);
                const indexPath = path.join(projectPath, 'index.html');
                const stats = fsSync.statSync(projectPath);
                
                // 폴더가 있으면 프로젝트로 인식 (index.html 있으면 indexPath 제공)
                projects.push({
                    folderName: projectFolder.name,
                    developer: developerName,
                    folderPath: `./${developerName}/${projectFolder.name}/`,
                    indexPath: fsSync.existsSync(indexPath) ? `./${developerName}/${projectFolder.name}/index.html` : null,
                    category: 'project',
                    developerPath: `./${developerName}/`,
                    lastModified: stats.mtime.toISOString(),
                    size: this.getProjectSize(projectPath)
                });
            }
        } catch (error) {
            Logger.warn(`${developerName} 폴더 스캔 중 오류:`, error.message);
        }
        
        return projects;
    }

    /**
     * 프로젝트 크기 계산 (KB)
     * @param {string} projectPath - 프로젝트 경로
     * @returns {number} 크기 (KB)
     */
    getProjectSize(projectPath) {
        try {
            let totalSize = 0;
            const files = fsSync.readdirSync(projectPath, { withFileTypes: true });
            
            for (const file of files) {
                if (file.isFile()) {
                    const filePath = path.join(projectPath, file.name);
                    const stats = fsSync.statSync(filePath);
                    totalSize += stats.size;
                }
            }
            
            return Math.round(totalSize / 1024); // KB로 변환
        } catch (error) {
            return 0;
        }
    }

    /**
     * 통계 생성
     * @param {Array} projects - 프로젝트 배열
     * @param {Array} developers - 개발자 배열
     * @returns {Object} 통계 객체
     */
    generateStats(projects, developers) {
        const developerStats = {};
        
        // 모든 개발자를 0으로 초기화
        developers.forEach(dev => {
            developerStats[dev.name] = 0;
        });
        
        // 실제 프로젝트 수 계산
        projects.forEach(project => {
            developerStats[project.developer]++;
        });
        
        return {
            totalProjects: projects.length,
            totalDevelopers: developers.length,
            activeDevelopers: projects.length > 0 ? 
                [...new Set(projects.map(p => p.developer))].length : 0,
            developerStats
        };
    }

    /**
     * 제외할 폴더인지 확인
     * @param {string} folderName - 폴더명
     * @returns {boolean}
     */
    isExcludedFolder(folderName) {
        return folderName.startsWith('.') || 
               CONFIG.EXCLUDED_FOLDERS.includes(folderName);
    }
}

/**
 * 정적 파일 서버 클래스
 */
class StaticFileServer {
    static async serveFile(res, filePath) {
        const ext = path.extname(filePath);
        const contentType = CONFIG.MIME_TYPES[ext] || 'text/plain';
        
        try {
            const data = await fs.readFile(filePath);
            ResponseHelper.setCORSHeaders(res);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        } catch (error) {
            Logger.warn(`파일 서빙 실패: ${filePath}`, error.message);
            ResponseHelper.send404(res);
        }
    }

    static isValidFilePath(filePath, basePath) {
        const resolvedPath = path.resolve(filePath);
        const resolvedBase = path.resolve(basePath);
        return resolvedPath.startsWith(resolvedBase);
    }
}

/**
 * 라우터 클래스
 */
class Router {
    constructor() {
        this.scanner = new ProjectScanner(process.cwd());
    }

    async handleRequest(req, res) {
        const url = new URL(req.url, `http://${CONFIG.HOST}:${CONFIG.PORT}`);
        const pathname = url.pathname;
        
        // CORS preflight 처리
        if (req.method === 'OPTIONS') {
            ResponseHelper.setCORSHeaders(res);
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            if (pathname === '/api/projects') {
                await this.handleProjectsAPI(res);
            } else if (pathname === '/') {
                await this.handleHomePage(res);
            } else {
                await this.handleStaticFile(res, pathname);
            }
        } catch (error) {
            Logger.error('요청 처리 중 오류:', error.message);
            ResponseHelper.sendError(res, '서버 오류가 발생했습니다.');
        }
    }

    async handleProjectsAPI(res) {
        Logger.info('프로젝트 스캔 요청 받음');
        
        const scanResult = this.scanner.scan();
        const { projects, developers, stats } = scanResult;
        
        const responseData = {
            generated: new Date().toISOString(),
            totalCount: stats.totalProjects,
            developerCount: stats.totalDevelopers,
            developerStats: stats.developerStats,
            projects: projects
        };
        
        Logger.success(
            `스캔 완료: ${stats.totalProjects}개 프로젝트, ` +
            `${stats.totalDevelopers}명 개발자 (활성: ${stats.activeDevelopers}명)`
        );
        
        ResponseHelper.sendJSON(res, responseData);
    }

    async handleHomePage(res) {
        const indexPath = path.join(__dirname, 'index.html');
        await StaticFileServer.serveFile(res, indexPath);
    }

    async handleStaticFile(res, pathname) {
        const filePath = path.join(__dirname, pathname);
        
        // 보안: 디렉토리 탐색 공격 방지
        if (!StaticFileServer.isValidFilePath(filePath, __dirname)) {
            Logger.warn(`잘못된 파일 경로 접근 시도: ${pathname}`);
            ResponseHelper.send404(res, '접근 권한이 없습니다.');
            return;
        }
        
        await StaticFileServer.serveFile(res, filePath);
    }
}

/**
 * 서버 클래스
 */
class ProjectBoardServer {
    constructor() {
        this.router = new Router();
        this.server = null;
    }

    start() {
        this.server = http.createServer((req, res) => {
            this.router.handleRequest(req, res);
        });

        this.server.listen(CONFIG.PORT, CONFIG.HOST, () => {
            Logger.success(`서버가 http://${CONFIG.HOST}:${CONFIG.PORT} 에서 실행 중입니다`);
            Logger.info(`프로젝트 스캔 API: http://${CONFIG.HOST}:${CONFIG.PORT}/api/projects`);
        });

        this.setupGracefulShutdown();
    }

    setupGracefulShutdown() {
        const shutdown = (signal) => {
            Logger.info(`\n${signal} 신호를 받았습니다. 서버를 안전하게 종료합니다...`);
            
            if (this.server) {
                this.server.close(() => {
                    Logger.success('서버가 성공적으로 종료되었습니다.');
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
}

// 서버 시작
if (require.main === module) {
    const server = new ProjectBoardServer();
    server.start();
}

module.exports = { ProjectBoardServer, ProjectScanner, CONFIG };