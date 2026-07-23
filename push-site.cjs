const { execSync } = require('child_process');
const dir = 'c:\\Users\\李叶彬\\Desktop\\my_web_now';

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: dir, encoding: 'utf8', timeout: 120000 });
    console.log(out);
  } catch (e) {
    console.log('ERR: ' + (e.stderr || e.message));
  }
}

run('git add .');
run('git commit -m "docs: detailed MSPM0G3507 blog post with code analysis, pin map, PID algorithm, encoder decoding"');
run('git push origin main');
