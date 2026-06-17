const fs = require('fs');
const txt = fs.readFileSync('C:/Users/HI/.gemini/antigravity-ide/brain/a9a1f15b-bac0-4136-89f5-444cc8c6820f/.system_generated/logs/transcript.jsonl', 'utf8');
const lines = txt.split('\n');
const results = [];
for (let l of lines) {
  if (l.includes('"name":"multi_replace_file_content"') || l.includes('"name":"replace_file_content"')) {
    try {
      const data = JSON.parse(l);
      if (data.tool_calls) {
        data.tool_calls.forEach(tc => {
          if (tc.name === 'multi_replace_file_content' || tc.name === 'replace_file_content') {
            results.push({ file: tc.args.TargetFile, desc: tc.args.Description });
          }
        });
      }
    } catch (e) { }
  }
}
console.log(JSON.stringify(results, null, 2));
