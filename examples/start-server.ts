import { SimplePageServer } from '../src/SimplePageServer';

async function main() {
  const port = parseInt(process.env.PORT || '3000');
  const server = new SimplePageServer(port);
  
  // Start the server
  await server.start();
  
  console.log(`Server started on port ${port}`);
  console.log('API endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /api/pages');
  console.log('  POST /api/pages');
  console.log('  GET  /api/pages/:pageId');
  console.log('  DELETE /api/pages/:pageId');
  console.log('  POST /api/pages/:pageId/navigate');
  console.log('  GET  /api/pages/:pageId/structure');
  console.log('  POST /api/pages/:pageId/act-xpath');
  console.log('  POST /api/pages/:pageId/act-id');
  console.log('  GET  /api/pages/:pageId/screenshot');
  console.log('  DELETE /api/pages/:pageId/actions/:actionIndex');
  console.log('  DELETE /api/pages/:pageId/records');
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nShutting down server...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(console.error);