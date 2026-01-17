// 简单的HTTP代理服务器，用于绕过CORS限制
const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    console.log(`\n收到请求: ${req.method} ${req.url}`);
    
    // 解析请求URL
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const queryParams = parsedUrl.query;
    
    // 设置CORS头
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // 处理OPTIONS请求
    if (req.method === 'OPTIONS') {
        console.log('处理OPTIONS请求');
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 处理状态检查请求
    if (pathname === '/status') {
        console.log('处理状态检查请求');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Proxy server is running' }));
        return;
    }
    
    // 处理代理请求
    if (pathname === '/proxy' || pathname === '/') {
        const targetUrl = queryParams.url;
        
        console.log(`目标URL: ${targetUrl}`);
        
        if (!targetUrl) {
            console.log('错误: 缺少目标URL');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing target URL' }));
            return;
        }
        
        // 解析目标URL
        const targetParsedUrl = url.parse(targetUrl);
        const isHttps = targetParsedUrl.protocol === 'https:';
        const port = targetParsedUrl.port || (isHttps ? 443 : 80);
        
        console.log(`解析后的目标: ${isHttps ? 'https' : 'http'}://${targetParsedUrl.hostname}:${port}${targetParsedUrl.path}`);
        
        // 创建代理请求选项
        const proxyOptions = {
            hostname: targetParsedUrl.hostname,
            port: port,
            path: targetParsedUrl.path,
            method: req.method,
            headers: req.headers,
            rejectUnauthorized: false // 允许自签名证书
        };
        
        // 移除不必要的头
        delete proxyOptions.headers.host;
        delete proxyOptions.headers.origin;
        
        console.log('代理请求选项:', proxyOptions);
        
        // 创建代理请求
        const proxyReq = (isHttps ? https : http).request(proxyOptions, (proxyRes) => {
            console.log(`代理响应状态: ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
            
            // 设置响应头
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            
            // 管道响应数据
            proxyRes.pipe(res, { end: true });
        });
        
        // 处理代理请求错误
        proxyReq.on('error', (err) => {
            console.error('代理错误:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
        });
        
        // 管道请求数据
        req.pipe(proxyReq, { end: true });
    } else {
        // 处理未知路径
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`Proxy server running at http://localhost:${PORT}`);
    console.log(`Usage: http://localhost:${PORT}?url=YOUR_TARGET_URL`);
    console.log(`Status check: http://localhost:${PORT}/status`);
    console.log(`Proxy endpoint: http://localhost:${PORT}/proxy?url=YOUR_TARGET_URL`);
});
