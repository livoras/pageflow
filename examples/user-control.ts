/**
 * 演示如何使用 Stagehand 的 A11y Tree 机制，用户完全控制逻辑
 */

import { Stagehand } from "../lib";
import fs from "fs";
import path from "path";

// 用户自定义的元素查找逻辑
function findElementByText(structure: string, text: string): string | null {
  const lines = structure.split('\n');
  for (const line of lines) {
    if (line.includes(text)) {
      const match = line.match(/\[([^\]]+)\]/);
      if (match) {
        return match[1]; // 返回 EncodedId
      }
    }
  }
  return null;
}

// 查找输入框
function findInputByLabel(structure: string, labelText: string): string | null {
  const lines = structure.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(labelText)) {
      // 查找下一个 textbox 或 input
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('textbox') || lines[j].includes('input')) {
          const match = lines[j].match(/\[([^\]]+)\]/);
          if (match) {
            return match[1];
          }
        }
      }
    }
  }
  return null;
}

async function demonstrateUserControl() {
  console.log("=== Stagehand 用户控制模式演示 ===\n");
  
  // 1. 初始化 Stagehand（无需 API Key）
  const stagehand = new Stagehand({
    env: "LOCAL",
    headless: false,
  });
  
  await stagehand.init();
  const page = stagehand.page;
  
  // 2. 访问本地测试页面
  const testPagePath = path.resolve(__dirname, '../test-page.html');
  console.log("访问测试页面:", testPagePath);
  await page.goto(`file://${testPagePath}`);
  await page.waitForLoadState("networkidle");
  
  // 3. 获取页面的 A11y Tree 结构
  console.log("\n获取页面 A11y Tree 结构...");
  const pageData = await page.getPageStructure();
  
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
  
  // 4. 用户逻辑：分析结构并选择要操作的元素
  console.log("=== 开始用户控制的操作 ===\n");
  
  // 查找并填写用户名
  const usernameId = findInputByLabel(pageData.simplified, "用户名");
  if (usernameId) {
    console.log(`找到用户名输入框: ${usernameId}`);
    await page.actByEncodedId(usernameId, "fill", ["张三"]);
    console.log("✓ 已填写用户名");
  }
  
  await page.waitForTimeout(500);
  
  // 查找并填写邮箱
  const emailId = findInputByLabel(pageData.simplified, "邮箱");
  if (emailId) {
    console.log(`找到邮箱输入框: ${emailId}`);
    await page.actByEncodedId(emailId, "fill", ["zhangsan@example.com"]);
    console.log("✓ 已填写邮箱");
  }
  
  await page.waitForTimeout(500);
  
  // 查找并选择年龄 - 查找 select 元素而不是 option
  const ageLines = pageData.simplified.split('\n');
  let ageSelectId = null;
  for (let i = 0; i < ageLines.length; i++) {
    if (ageLines[i].includes('select') && ageLines[i].includes('年龄')) {
      const match = ageLines[i].match(/\[([^\]]+)\]/);
      if (match) {
        ageSelectId = match[1];
        console.log(`找到年龄下拉框 (select): ${ageSelectId}`);
        console.log(`  实际找到的行: ${ageLines[i]}`);
        break;
      }
    }
  }
  
  if (ageSelectId) {
    await page.actByEncodedId(ageSelectId, "select", ["26-35"]);
    console.log("✓ 已选择年龄");
  } else {
    console.log("未找到年龄下拉框的 select 元素");
  }
  
  await page.waitForTimeout(500);
  
  // 查找并填写留言
  const messageId = findInputByLabel(pageData.simplified, "留言");
  if (messageId) {
    console.log(`找到留言框: ${messageId}`);
    await page.actByEncodedId(messageId, "fill", ["这是通过 A11y Tree 自动填写的内容"]);
    console.log("✓ 已填写留言");
  }
  
  await page.waitForTimeout(500);
  
  // 查找并勾选同意条款
  const agreeId = findElementByText(pageData.simplified, "我同意条款");
  if (agreeId) {
    console.log(`找到同意条款复选框: ${agreeId}`);
    await page.actByEncodedId(agreeId, "check");
    console.log("✓ 已勾选同意条款");
  }
  
  await page.waitForTimeout(500);
  
  // 查找并点击提交按钮
  const submitId = findElementByText(pageData.simplified, "提交");
  if (submitId) {
    console.log(`找到提交按钮: ${submitId}`);
    await page.actByEncodedId(submitId, "click");
    console.log("✓ 已点击提交");
  }
  
  // 等待查看结果
  console.log("\n等待 3 秒查看结果...");
  await page.waitForTimeout(3000);
  
  await stagehand.close();
  console.log("\n演示完成！");
  
  console.log("\n=== 总结 ===");
  console.log("1. 使用 getPageStructure() 获取页面的 A11y Tree");
  console.log("2. 用户通过自定义逻辑分析树结构，找到目标元素的 EncodedId");
  console.log("3. 使用 actByEncodedId() 操作元素");
  console.log("4. 完全不需要 AI，用户掌控所有逻辑");
}

// 运行演示
demonstrateUserControl().catch(console.error);