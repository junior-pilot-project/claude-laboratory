const http = require('http');
const fs = require('fs');
const path = require('path');

class StaticFileServer {
    constructor() {
        this.mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon'
        };
    }

    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.mimeTypes[ext] || 'text/plain';
    }

    serveFile(req, res) {
        let filePath = req.url === '/' ? '/index.html' : req.url;
        
        // 보안: 디렉토리 탐색 공격 방지
        if (filePath.includes('..')) {
            this.sendError(res, 403, 'Forbidden');
            return;
        }

        filePath = path.join(__dirname, filePath);

        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    this.sendError(res, 404, 'File Not Found');
                } else {
                    this.sendError(res, 500, 'Internal Server Error');
                }
                return;
            }

            const mimeType = this.getMimeType(filePath);
            res.writeHead(200, {
                'Content-Type': mimeType,
                'Content-Length': data.length
            });
            res.end(data);
        });
    }

    sendError(res, statusCode, message) {
        res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
        res.end(message);
    }
}

class RaceConditionServer {
    constructor(port = 8000, host = 'localhost') {
        this.port = port;
        this.host = host;
        this.fileServer = new StaticFileServer();
        this.server = null;
    }

    start() {
        this.server = http.createServer((req, res) => {
            // CORS 헤더 추가 (개발 환경용)
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            console.log(`📡 ${req.method} ${req.url}`);
            this.fileServer.serveFile(req, res);
        });

        this.server.listen(this.port, this.host, () => {
            console.log('🎯 Race Condition 데모 서버가 시작되었습니다!');
            console.log(`🌐 URL: http://${this.host}:${this.port}`);
            console.log('🎮 브라우저에서 접속하여 5명의 쿠폰 경쟁을 확인해보세요!');
        });

        // 우아한 종료 처리
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }

    shutdown() {
        console.log('\n⏹️  서버를 종료하는 중...');
        
        if (this.server) {
            this.server.close(() => {
                console.log('✅ 서버가 정상적으로 종료되었습니다.');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    }
}

// 환경 변수에서 포트와 호스트 읽기
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || 'localhost';

// 서버 시작
const server = new RaceConditionServer(PORT, HOST);
server.start();