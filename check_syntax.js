const fs = require('fs');

// 读取文件内容
const content = fs.readFileSync('script.js', 'utf8');

// 检查文件是否以正常的方式结束
if (content.trim().endsWith('}')) {
    console.log('文件结束正常');
} else {
    console.log('文件结束异常');
    // 输出文件的最后100个字符
    console.log('文件末尾100个字符:', JSON.stringify(content.slice(-100)));
}

// 尝试使用语法检查
console.log('\n正在检查语法...');
try {
    // 尝试使用eval检查语法
    new Function(content);
    console.log('语法检查通过');
} catch (error) {
    console.log('语法错误:', error.message);
    console.log('错误位置:', error.stack.split('at new Function')[0]);
}