const { execSync } = require('child_process');
const dir = 'c:\\Users\\李叶彬\\Desktop\\my_web_now';

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: dir, encoding: 'utf8', timeout: 120000 });
    console.log(out);
    return true;
  } catch (e) {
    console.log('ERR: ' + (e.stderr || e.message));
    return false;
  }
}

run('git add .');
run('git commit -m "feat: add MSPM0G3507 project to works page and blog"');
run('git push origin main');
