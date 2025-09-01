import { Stagehand } from '../lib/index';

async function testXPath() {
  const stagehand = new Stagehand({
    headless: false,
    verbose: 0,
    debugDom: false,
  });

  try {
    await stagehand.init();
    const page = stagehand.page;
    
    // 访问百度首页
    await page.goto('https://www.baidu.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // 获取页面结构
    const structure = await page.getPageStructure();
    console.log('获取页面结构成功');
    
    // 找到搜索框的 XPath（从之前的测试中我们知道是稳定的）
    const searchBoxXPath = '/html[1]/body[1]/div[1]/div[1]/div[6]/div[1]/div[1]/form[1]/span[1]/input[1]';
    const searchButtonXPath = '/html[1]/body[1]/div[1]/div[1]/div[6]/div[1]/div[1]/form[1]/span[2]/input[1]';
    
    // 使用新的 actByXPath 方法
    console.log('使用 actByXPath 填写搜索框...');
    await page.actByXPath(searchBoxXPath, 'fill', ['Stagehand XPath Test']);
    
    await page.waitForTimeout(1000);
    
    console.log('使用 actByXPath 点击搜索按钮...');
    await page.actByXPath(searchButtonXPath, 'click');
    
    await page.waitForTimeout(3000);
    console.log('✓ XPath 接口测试成功！');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await stagehand.close();
  }
}

testXPath().catch(console.error);