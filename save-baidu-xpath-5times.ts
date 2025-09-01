import fs from 'fs';
import { Stagehand } from './lib/index';

async function saveBaiduXPath() {
  for (let i = 1; i <= 5; i++) {
    console.log(`第 ${i} 次访问...`);
    
    const stagehand = new Stagehand({
      headless: false,
      verbose: 0,
      debugDom: false,
    });
    
    try {
      await stagehand.init();
      await stagehand.page.goto('https://www.baidu.com', { waitUntil: 'networkidle' });
      await stagehand.page.waitForTimeout(2000);
      
      const structure = await stagehand.page.getPageStructure();
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `baidu-xpath-${i}-${timestamp}.json`;
      
      // 保存 xpathMap
      fs.writeFileSync(filename, JSON.stringify(structure.xpathMap, null, 2), 'utf-8');
      console.log(`  已保存到: ${filename}`);
      
    } catch (error) {
      console.error(`第 ${i} 次访问出错:`, error);
    } finally {
      await stagehand.close();
    }
    
    if (i < 5) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\n完成。使用 Read 工具查看文件。');
}

saveBaiduXPath().catch(console.error);