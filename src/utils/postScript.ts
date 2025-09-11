import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

export function addPostScript(
  pageId: string,
  actionIndex: number,
  script: string
): void {
  // Find the actions.json file
  const actionsPath = path.join(process.env.TMPDIR || '/tmp', 'simplepage', pageId, 'actions.json');
  
  if (!fs.existsSync(actionsPath)) {
    throw new Error(`Actions file not found: ${actionsPath}`);
  }
  
  // Read and parse actions.json
  const actionsContent = fs.readFileSync(actionsPath, 'utf-8');
  const actionsData = JSON.parse(actionsContent);
  
  // Validate action index
  if (!actionsData.actions || actionIndex >= actionsData.actions.length) {
    throw new Error(`Invalid action index: ${actionIndex}`);
  }
  
  // Initialize postScripts array if it doesn't exist
  if (!actionsData.actions[actionIndex].postScripts) {
    actionsData.actions[actionIndex].postScripts = [];
  }
  
  // Add the script
  actionsData.actions[actionIndex].postScripts.push(script);
  
  // Write back to file
  fs.writeFileSync(actionsPath, JSON.stringify(actionsData, null, 2));
}

export function removePostScript(
  pageId: string,
  actionIndex: number,
  scriptIndex: number
): void {
  // Find the actions.json file
  const actionsPath = path.join(process.env.TMPDIR || '/tmp', 'simplepage', pageId, 'actions.json');
  
  if (!fs.existsSync(actionsPath)) {
    throw new Error(`Actions file not found: ${actionsPath}`);
  }
  
  // Read and parse actions.json
  const actionsContent = fs.readFileSync(actionsPath, 'utf-8');
  const actionsData = JSON.parse(actionsContent);
  
  // Validate action index
  if (!actionsData.actions || actionIndex >= actionsData.actions.length) {
    throw new Error(`Invalid action index: ${actionIndex}`);
  }
  
  const action = actionsData.actions[actionIndex];
  
  // Check if postScripts exist
  if (!action.postScripts || action.postScripts.length === 0) {
    throw new Error(`No postScripts found for action at index ${actionIndex}`);
  }
  
  // Validate script index
  if (scriptIndex >= action.postScripts.length) {
    throw new Error(`Script index ${scriptIndex} out of range. Available scripts: ${action.postScripts.length}`);
  }
  
  // Remove the script
  action.postScripts.splice(scriptIndex, 1);
  
  // Write back to file
  fs.writeFileSync(actionsPath, JSON.stringify(actionsData, null, 2));
}

export function runPostScript(
  pageId: string,
  actionIndex: number,
  scriptIndex?: number
): any {
  // Find the actions.json file
  const actionsPath = path.join(process.env.TMPDIR || '/tmp', 'simplepage', pageId, 'actions.json');
  
  if (!fs.existsSync(actionsPath)) {
    throw new Error(`Actions file not found: ${actionsPath}`);
  }
  
  // Read and parse actions.json
  const actionsContent = fs.readFileSync(actionsPath, 'utf-8');
  const actionsData = JSON.parse(actionsContent);
  
  // Get the specific action
  if (!actionsData.actions || actionIndex >= actionsData.actions.length) {
    throw new Error(`Invalid action index: ${actionIndex}`);
  }
  
  const action = actionsData.actions[actionIndex];
  
  // Check if postScripts exist
  if (!action.postScripts || action.postScripts.length === 0) {
    throw new Error(`No postScripts found for action at index ${actionIndex}`);
  }
  
  // Determine which script to run
  let targetScript: string;
  if (scriptIndex !== undefined) {
    if (scriptIndex >= action.postScripts.length) {
      throw new Error(`Script index ${scriptIndex} out of range. Available scripts: ${action.postScripts.length}`);
    }
    targetScript = action.postScripts[scriptIndex];
  } else {
    // Run the last (most recent) script by default
    targetScript = action.postScripts[action.postScripts.length - 1];
  }
  
  const dataDir = path.join(path.dirname(actionsPath), 'data');
  
  // Determine the target file based on action type
  let targetFile: string | null = null;
  let isJsonList = false;
  
  if (action.listFile) {
    // Handle list extraction actions (getListHtml, getListHtmlByParent)
    targetFile = path.join(dataDir, action.listFile);
    isJsonList = true;
  } else if (action.elementFile) {
    // Handle element extraction action (getElementHtml)
    targetFile = path.join(dataDir, action.elementFile);
    isJsonList = false;
  } else if (action.timestamp) {
    // Try to find page HTML for other actions
    const pageHtmlFile = `${action.timestamp}-page.html`;
    const pageHtmlPath = path.join(dataDir, pageHtmlFile);
    if (fs.existsSync(pageHtmlPath)) {
      targetFile = pageHtmlPath;
      isJsonList = false;
    }
  }
  
  if (!targetFile || !fs.existsSync(targetFile)) {
    throw new Error(`No data file found for action at index ${actionIndex}`);
  }
  
  // Process based on file type and execute script
  if (isJsonList) {
    // Handle JSON list files
    const jsonContent = fs.readFileSync(targetFile, 'utf-8');
    const htmlArray = JSON.parse(jsonContent);
    
    // Create function that accepts array of HTML strings
    const userFunc = new Function('htmlArray', 'cheerio', `return (${targetScript})(htmlArray, cheerio);`);
    return userFunc(htmlArray, cheerio);
  } else {
    // Handle single HTML files
    const html = fs.readFileSync(targetFile, 'utf-8');
    
    // Create function that accepts single HTML string
    const userFunc = new Function('html', 'cheerio', `return (${targetScript})(html, cheerio);`);
    return userFunc(html, cheerio);
  }
}