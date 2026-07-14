// 从教财系统上报数据包中提取各校属性（学校类别/隶属关系/地区/城乡分类/普惠性），
// 生成 rules/学校属性.json，供年报校验规则引擎按校注入上下文参数。
// 用法：node scripts/build-school-attributes.js [数据包根目录] [输出文件]
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || 'E:\\经费年报\\2025年学校经费年报数据');
const output = path.resolve(process.argv[3] || path.join(__dirname, '..', 'rules', '学校属性.json'));

function tag(xml, name) {
  const match = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  return match ? match[1].trim() : '';
}

function findSchoolInfo(dir) {
  const candidates = [
    path.join(dir, 'ziptemp', 'ModelSchoolInfo.xml'),
    path.join(dir, 'ModelSchoolInfo.xml'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function main() {
  if (!fs.existsSync(root)) throw new Error(`数据包目录不存在：${root}`);
  const schools = [];
  const seen = new Set();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const infoPath = findSchoolInfo(path.join(root, entry.name));
    if (!infoPath) continue;
    const xml = fs.readFileSync(infoPath, 'utf8');
    const name = tag(xml, 'XXMC');
    if (!name || seen.has(name)) continue;
    seen.add(name);
    schools.push({
      name,
      dwdm: tag(xml, 'XXDM'),
      dqdm: tag(xml, 'DQDM'),
      xxlbdm: tag(xml, 'XXLBDM'),
      lsgxdm: tag(xml, 'LSGXDM'),
      cxfldm: tag(xml, 'CXFLDM'),
      phx: tag(xml, 'PHX'),
    });
  }
  schools.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(schools, null, 2), 'utf8');
  const missing = schools.filter((s) => !s.xxlbdm || !s.lsgxdm).map((s) => s.name);
  console.log(`已提取 ${schools.length} 所学校属性 -> ${output}`);
  if (missing.length) console.log(`缺少类别/隶属代码的学校（${missing.length}）：${missing.slice(0, 10).join('、')}`);
}

main();
