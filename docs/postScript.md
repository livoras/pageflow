# PostScript Management

PostScript functions allow you to attach and execute JavaScript code on HTML data extracted by SimplePage actions.

## Functions

### addPostScript(pageId, actionIndex, script)
Adds a JavaScript function to an action's postScripts array.

```javascript
addPostScript('page-id', 10, '(htmlArray, cheerio) => ({ count: htmlArray.length })');
```

### runPostScript(pageId, actionIndex, scriptIndex?)
Executes a saved postScript and returns the result.

```javascript
// Run latest script
const result = await runPostScript('page-id', 10);

// Run specific script by index
const result = await runPostScript('page-id', 10, 0);
```

### removePostScript(pageId, actionIndex, scriptIndex)
Removes a postScript from the array.

```javascript
removePostScript('page-id', 10, 0);
```

## Script Parameters

Scripts receive different parameters based on the action type:

- **List actions** (getListHtml, getListHtmlByParent): `(htmlArray, cheerio)`
- **Element actions** (getElementHtml): `(html, cheerio)`
- **Page actions**: `(html, cheerio)`

## Storage

Scripts are stored in the `postScripts` array field of each action in `actions.json`:

```json
{
  "type": "getListHtml",
  "listFile": "1234567890-list.json",
  "postScripts": [
    "(htmlArray, cheerio) => ({ count: htmlArray.length })"
  ]
}
```