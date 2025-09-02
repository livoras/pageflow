@src/SimplePage.ts 应该要记录每次操作的和对应的 snapshot

1. 创建的时候，可以传入 id: new SimplePage(page, id)
2. 为每个 id 创建独特的（os.temp下）的目录
3. 目录中有一个 actions.json 存储操作的描述和对应的 snapshot
  * {
    id: xxxx
    description: xxx
    actions: [
      {
         type: 'create',
         url: 'xxxxx',
         timestamp: 13431,
         structure: 'xxxxx.txt',
         xpathMap: 'xxx.json',
      },
      {
         type: 'act'
         method: 'click',
         xpath: 'xxx',
         args: []...
         timestamp: 1733431..,
         structure: 'xxxxx.txt',
         xpathMap: 'xxx.json',
      }
      ,
      {
        type: 'close',
        ...
      }
    ]
  }
4. 里面的 structure 和 xpathMap 也是存储到这个目录中的一个 data/ 目录中
