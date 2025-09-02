import { chromium } from 'playwright';
import { SimplePage } from '../src/SimplePage';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';
import path from 'path';

async function getStructure(url: string) {
  // 1. 生成文件名
  const urlHash = createHash('md5').update(url).digest('hex').substring(0, 8);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFileName = `${urlHash}-${timestamp}`;
  
  // 2. 启动浏览器并获取结构
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const sp = new SimplePage(page);
  await sp.init();
  
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  
  const structure = await sp.getPageStructure();
  
  // 3. 保存文件到临时目录
  const tmpDir = tmpdir();
  const txtPath = path.join(tmpDir, `${baseFileName}.txt`);
  const jsonPath = path.join(tmpDir, `${baseFileName}.json`);
  
  // 保存页面结构为 .txt
  writeFileSync(txtPath, structure.simplified);
  
  // 保存 xpathMap 为 .json
  writeFileSync(jsonPath, JSON.stringify(structure.xpathMap, null, 2));
  
  await browser.close();
  
  // 4. 返回结果对象
  const result = {
    pageStructure: txtPath,
    xpathMap: jsonPath
  };
  
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// 命令行参数处理
const url = process.argv[2];
if (!url) {
  console.error('Usage: tsx examples/get-structure.ts <url>');
  process.exit(1);
}

getStructure(url).catch(console.error);