/**
 * 演示如何使用独立的 SimplePage 类
 */

import { chromium } from 'playwright';
import { SimplePage } from '../src/SimplePage';
import fs from "fs";
import path from "path";


async function demonstrateUserControl() {
  console.log("=== SimplePage 用户控制模式演示 ===\n");
  
  // 1. 使用原生 Playwright 初始化浏览器
  const browser = await chromium.launch({
    headless: false,
  });
  const page = await browser.newPage();
  
  // 2. 创建 SimplePage 实例（只需要 Playwright page）
  const sp = new SimplePage(page);
  await sp.init();
  
  // 3. 访问本地测试页面
  const testPagePath = path.resolve(__dirname, '../test-page.html');
  console.log("访问测试页面:", testPagePath);
  await page.goto(`file://${testPagePath}`);
  await page.waitForLoadState("networkidle");
  
  // 4. 获取页面的 A11y Tree 结构
  console.log("\n获取页面 A11y Tree 结构...");
  const pageData = await sp.getPageStructure();
  
  // 保存结构供分析
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const structureFile = path.join(process.cwd(), `test-structure-${timestamp}.txt`);
  fs.writeFileSync(structureFile, pageData.simplified, 'utf-8');
  console.log("页面结构已保存到:", structureFile);
  
  // 显示部分结构
  console.log("\n页面结构预览:");
  const lines = pageData.simplified.split('\n');
  console.log(lines.slice(0, 20).join('\n'));
  console.log(`... 共 ${lines.length} 行\n`);
  
  // 5. 用户逻辑：使用硬编码的 ID 直接操作元素
  console.log("=== 开始用户控制的操作 ===\n");
  
  // 填写用户名 - 硬编码 ID: 0-3
  const usernameId = "0-3";
  console.log(`用户名输入框: ${usernameId}`);
  await sp.actByEncodedId(usernameId, "fill", ["张三"]);
  console.log("✓ 已填写用户名");
  
  await page.waitForTimeout(500);
  
  // 填写邮箱 - 硬编码 ID: 0-4
  const emailId = "0-4";
  console.log(`邮箱输入框: ${emailId}`);
  await sp.actByEncodedId(emailId, "fill", ["zhangsan@example.com"]);
  console.log("✓ 已填写邮箱");
  
  await page.waitForTimeout(500);
  
  // 选择年龄 - 直接使用 select 元素的 ID
  const ageSelectId = "0-34"; // select 元素
  console.log(`选择年龄下拉框: ${ageSelectId}`);
  await sp.actByEncodedId(ageSelectId, "select", ["26-35"]);
  console.log("✓ 已选择年龄");
  
  await page.waitForTimeout(500);
  
  // 填写留言 - 硬编码 ID: 0-76
  const messageId = "0-76";
  console.log(`留言框: ${messageId}`);
  await sp.actByEncodedId(messageId, "fill", ["这是通过 SimplePage 自动填写的内容"]);
  console.log("✓ 已填写留言");
  
  await page.waitForTimeout(500);
  
  // 勾选同意条款 - 硬编码 ID: 0-83
  const agreeId = "0-83";
  console.log(`同意条款复选框: ${agreeId}`);
  await sp.actByEncodedId(agreeId, "check");
  console.log("✓ 已勾选同意条款");
  
  await page.waitForTimeout(500);
  
  // 点击提交按钮 - 硬编码 ID: 0-85
  const submitId = "0-85";
  console.log(`提交按钮: ${submitId}`);
  await sp.actByEncodedId(submitId, "click");
  console.log("✓ 已点击提交");
  
  // 等待查看结果
  console.log("\n等待 3 秒查看结果...");
  await page.waitForTimeout(3000);
  
  await browser.close();
  console.log("\n演示完成！");
  
  console.log("\n=== 总结 ===");
  console.log("1. 使用独立的 SimplePage 类");
  console.log("2. 只需要 Playwright page 即可创建实例");
  console.log("3. 使用 getPageStructure() 获取页面的 A11y Tree");
  console.log("4. 使用 actByEncodedId() 执行操作");
  console.log("5. 完全不需要 AI，用户掌控所有逻辑");
}

// 运行演示
demonstrateUserControl().catch(console.error);