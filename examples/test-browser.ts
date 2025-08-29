/**
 * 测试极简版浏览器自动化框架
 */

import { createPage } from '../lib/browser';

async function testBrowser() {
  console.log('=== 测试极简版浏览器自动化 ===\n');
  
  // 创建页面并访问百度
  console.log('1. 创建页面并访问百度...');
  const page = await createPage('https://www.baidu.com', {
    headless: false,
    viewport: { width: 1280, height: 720 }
  });
  
  // 等待页面加载
  await page.waitForTimeout(2000);
  
  // 获取页面结构
  console.log('2. 获取页面结构...');
  const structure = await page.getPageStructure();
  console.log(`   - 获取到 ${Object.keys(structure.xpathMap).length} 个元素`);
  console.log(`   - 结构行数: ${structure.simplified.split('\n').length}`);
  
  // 显示前几行
  const lines = structure.simplified.split('\n');
  console.log('\n前5行结构:');
  console.log(lines.slice(0, 5).join('\n'));
  
  // 查找搜索框
  const searchBoxLine = lines.find(line => line.includes('textbox'));
  if (searchBoxLine) {
    const match = searchBoxLine.match(/\[([^\]]+)\]/);
    if (match) {
      const searchBoxId = match[1];
      console.log(`\n3. 找到搜索框: ${searchBoxId}`);
      
      // 填充搜索框
      console.log('4. 填充搜索内容...');
      await page.actByEncodedId(searchBoxId, 'fill', ['极简自动化测试']);
      console.log('   ✓ 已填充');
      
      // 等待用户查看效果
      console.log('\n5. 等待5秒查看效果...');
      await page.waitForTimeout(5000);
    }
  }
  
  // 关闭页面
  console.log('6. 关闭页面');
  await page.close();
  
  console.log('\n✅ 测试完成！');
}

// 运行测试
testBrowser().catch(console.error);