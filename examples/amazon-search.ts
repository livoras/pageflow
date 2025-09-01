/**
 * 亚马逊搜索脚本 - 迭代探索式开发
 * 完整流程：搜索卷发棒并点击第二个商品
 */

import { Stagehand } from "../lib";
import fs from "fs";
import path from "path";

async function amazonSearch() {
  console.log("=== 亚马逊搜索脚本 ===\n");
  
  const stagehand = new Stagehand({
    env: "LOCAL",
    headless: false,
  });
  
  await stagehand.init();
  const page = stagehand.page;
  
  // 步骤1：访问亚马逊主页
  console.log("步骤1：访问亚马逊主页");
  await page.goto("https://www.amazon.com");
  await page.waitForTimeout(5000);
  
  // 获取页面结构（用于后续分析）
  const structure1 = await page.getPageStructure();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(`amazon-step1-${timestamp}.txt`, structure1.simplified, 'utf-8');
  console.log("已保存主页结构");
  
  // 步骤2：输入搜索关键词
  console.log("\n步骤2：输入搜索关键词");
  const searchBoxId = "0-7"; // textbox: Search For
  await page.actByEncodedId(searchBoxId, "fill", ["卷发棒"]);
  await page.waitForTimeout(1000);
  
  // 获取输入后的结构，找到搜索按钮 ID
  const structure2 = await page.getPageStructure();
  fs.writeFileSync(`amazon-step2-${timestamp}.txt`, structure2.simplified, 'utf-8');
  console.log("已保存输入后结构");
  
  // 步骤3：点击搜索按钮
  console.log("\n步骤3：点击搜索按钮");
  const searchButtonId = "0-486"; // button: Go
  await page.actByEncodedId(searchButtonId, "click");
  
  console.log("等待搜索结果加载...");
  await page.waitForTimeout(5000);
  
  // 获取搜索结果页结构
  const structure3 = await page.getPageStructure();
  fs.writeFileSync(`amazon-step3-${timestamp}.txt`, structure3.simplified, 'utf-8');
  console.log("已保存搜索结果页结构");
  
  // 先运行到这里，分析 structure3 找到第二个商品链接
  console.log("\n请分析 amazon-step3-*.txt 文件找到第二个商品链接 ID");
  console.log("然后更新脚本继续");
  
  await stagehand.close();
  console.log("脚本完成");
}

// 运行
amazonSearch().catch(console.error);