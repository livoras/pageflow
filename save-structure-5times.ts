/**
 * 访问亚马逊5次，每次保存页面结构
 */

import { Stagehand } from "./lib";

async function saveStructures() {
  for (let i = 1; i <= 5; i++) {
    console.log(`第 ${i} 次访问...`);
    
    const stagehand = new Stagehand({
      env: "LOCAL",
      headless: true,
    });
    
    await stagehand.init();
    const page = stagehand.page;
    
    await page.goto("https://www.amazon.com");
    await page.waitForTimeout(3000);
    
    const pageData = await page.getPageStructure();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `amazon-structure-${i}-${timestamp}.txt`;
    
    require('fs').writeFileSync(filename, pageData.simplified, 'utf-8');
    console.log(`  已保存到: ${filename}`);
    
    await stagehand.close();
    
    if (i < 5) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log("\n完成。使用 Read 工具查看文件。");
}

saveStructures().catch(console.error);