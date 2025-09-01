/**
 * 访问本地测试页面5次，每次保存页面结构
 */

import { Stagehand } from "./lib";
import path from "path";

async function saveLocalStructures() {
  const testPagePath = path.resolve(__dirname, 'test-page.html');
  
  for (let i = 1; i <= 5; i++) {
    console.log(`第 ${i} 次访问本地页面...`);
    
    const stagehand = new Stagehand({
      env: "LOCAL",
      headless: true,
    });
    
    await stagehand.init();
    const page = stagehand.page;
    
    await page.goto(`file://${testPagePath}`);
    await page.waitForTimeout(1000);
    
    const pageData = await page.getPageStructure();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `local-structure-${i}-${timestamp}.txt`;
    
    require('fs').writeFileSync(filename, pageData.simplified, 'utf-8');
    console.log(`  已保存到: ${filename}`);
    
    await stagehand.close();
    
    if (i < 5) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log("\n完成。");
}

saveLocalStructures().catch(console.error);