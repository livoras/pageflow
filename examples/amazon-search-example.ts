import { SimplePageClient } from '../src/client/SimplePageClient';

async function searchAmazonProduct() {
  const client = new SimplePageClient('http://localhost:3000');

  try {
    // 创建页面并打开亚马逊
    console.log('打开亚马逊主页...');
    const page = await client.createPage('Amazon Search', 'https://www.amazon.com', {
      description: '打开亚马逊主页'
    });

    // 等待页面加载
    await page.wait(3000, '等待页面完全加载');

    // 获取页面结构
    const structure = await page.getStructure();
    console.log('获取页面结构成功，actions记录在:', structure.actionsPath);

    // 在搜索框输入"卷发棒"
    console.log('搜索卷发棒...');
    await page.fill('/html[1]/body[1]/div[1]/header[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[3]/div[1]/input[1]', 
      '卷发棒', '在搜索框输入卷发棒');

    // 点击搜索按钮
    await page.click('/html[1]/body[1]/div[1]/header[1]/div[1]/div[1]/div[2]/div[1]/form[1]/div[4]/div[1]/span[1]/input[1]', 
      '点击搜索按钮');

    // 等待搜索结果加载
    await page.wait(3000, '等待搜索结果');

    // 点击第三个商品
    console.log('点击第三个商品...');
    await page.click('/html[1]/body[1]/div[1]/div[1]/div[1]/div[1]/div[1]/span[1]/div[1]/div[4]/div[1]/div[1]/span[1]/div[1]/div[1]/div[2]/div[1]/a[1]', 
      '点击第三个商品 - Automatic Curling Iron');

    // 等待商品页面加载
    await page.wait(3000, '等待商品页面加载');

    // 获取最终页面信息
    const pageInfo = await page.refresh();
    console.log('当前页面URL:', pageInfo.url);
    console.log('页面标题:', pageInfo.title);
    console.log('操作记录保存在:', pageInfo.consoleLogPath);

    // 截图保存
    const screenshot = await page.screenshot();
    console.log('截图大小:', screenshot.length, 'bytes');

    // 关闭页面
    await page.close();
    console.log('页面已关闭');

  } catch (error) {
    console.error('执行出错:', error);
  }
}

// 执行示例
if (require.main === module) {
  searchAmazonProduct().catch(console.error);
}