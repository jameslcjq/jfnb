const { CONTROL_SECTIONS, CONTROL_FIELDS, META_FIELDS, stagePartsForSchoolStage } = require('./fields');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function attr(value) {
  return escapeHtml(value);
}

// 供 <script type="application/json"> 内嵌：保持合法 JSON（不做 HTML 实体转义，
// 否则 script 原始文本里的 &quot; 不会被解码、JSON.parse 会失败），仅防止 </script> 逃逸。
function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const BASE_CSS = `
*{box-sizing:border-box}
body{margin:0;background:#f5f7fb;color:#1f2430;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:640px;margin:0 auto;padding:16px}
.wrap.wide{max-width:1120px}
.card{background:#fff;border:1px solid #e6e9f0;border-radius:12px;padding:16px;margin-bottom:16px}
h1{font-size:20px;font-weight:600;margin:8px 0}
h2{font-size:16px;font-weight:600;margin:0 0 4px}
.muted{color:#6b7280;font-size:14px}
.sect-desc{color:#6b7280;font-size:13px;margin-bottom:12px}
.field{margin-bottom:14px}
.field.hidden{display:none}
.card.hidden{display:none}
.field label{display:block;font-size:14px;font-weight:500;margin-bottom:6px}
.field .hint{color:#8a92a6;font-size:12px;margin-top:4px}
input[type=text],input[type=tel],input[type=number],textarea{width:100%;padding:11px 12px;border:1px solid #d4d9e3;border-radius:8px;font-size:16px;background:#fff}
input:focus,textarea:focus{outline:none;border-color:#3b6ef5;box-shadow:0 0 0 3px rgba(59,110,245,.12)}
textarea{min-height:64px;resize:vertical}
.err{border-color:#e24b4a!important}
.err-msg{color:#c0392b;font-size:12px;margin-top:4px}
.wage-warn{background:#fdf3e3;border:1px solid #f0c674;color:#8a5a12;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.6;margin-bottom:12px}
.mini-btn{padding:3px 8px;border:1px solid #d4d9e3;border-radius:6px;background:#fff;font-size:12px;cursor:pointer;color:#333}
.mini-btn:hover{border-color:#3b6ef5;color:#2446a6}
.collect-actions{margin-top:4px;white-space:nowrap}
.toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #f0f2f7}
.toggle:last-child{border-bottom:none}
.toggle .t-label{font-size:15px}
.switch{position:relative;width:50px;height:28px;flex:none}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;inset:0;background:#cfd5e0;border-radius:999px;transition:.2s}
.slider:before{content:"";position:absolute;height:22px;width:22px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
.switch input:checked+.slider{background:#3b6ef5}
.switch input:checked+.slider:before{transform:translateX(22px)}
.amount-box{margin:8px 0 4px;padding:12px;background:#f7f9fc;border-radius:8px}
.amount-box.hidden{display:none}
.btn{display:block;width:100%;padding:13px;border:none;border-radius:8px;background:#3b6ef5;color:#fff;font-size:16px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none}
.btn:disabled{opacity:.6;cursor:default}
.btn-ghost{background:#eef1f7;color:#333}
.mini-btn{padding:6px 10px;border:none;border-radius:6px;background:#3b6ef5;color:#fff;font-size:13px;cursor:pointer;white-space:nowrap}
.mini-btn.secondary{background:#eef1f7;color:#333}
.locked{background:#f0f4ff;border:1px solid #d6e0ff;border-radius:8px;padding:10px 12px;font-size:15px}
.school-picker{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end}
.school-picker select{width:100%;padding:11px 12px;border:1px solid #d4d9e3;border-radius:8px;font-size:16px;background:#fff}
.school-picker.two{grid-template-columns:220px minmax(0,1fr)}
.year-note{background:#fff;border:1px solid #dbe4ff;border-radius:12px;padding:14px 16px;margin-bottom:16px}
.year-note strong{color:#2446a6}
.overlay{position:fixed;inset:0;background:rgba(20,24,35,.5);display:none;align-items:flex-end;justify-content:center;z-index:50}
.overlay.show{display:flex}
.sheet{background:#fff;border-radius:16px 16px 0 0;max-width:640px;width:100%;max-height:86vh;overflow:auto;padding:20px}
.sum-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f2f7;font-size:15px}
.sum-row .k{color:#6b7280}
.sum-row .v{font-weight:600}
.ok-icon{width:56px;height:56px;border-radius:50%;background:#e7f6ee;color:#1d9e75;font-size:30px;display:flex;align-items:center;justify-content:center;margin:8px auto}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eef1f6}
th{color:#6b7280;font-weight:500;background:#f7f9fc}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:500}
.b-done{background:#e7f6ee;color:#1d7a56}
.b-wait{background:#fdeee0;color:#a5641a}
.grp-title{font-size:15px;font-weight:600;margin:18px 0 6px}
a{color:#3b6ef5}
@media(max-width:720px){.school-picker,.school-picker.two{grid-template-columns:1fr}.wrap.wide{padding:12px}th,td{padding:7px 8px}}
`;

function layout(title, bodyHtml, extraHead = '') {
  return `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>${escapeHtml(title)}</title>
<style>${BASE_CSS}</style>${extraHead}
</head><body>${bodyHtml}</body></html>`;
}

function numberInput(field, values, errors) {
  const val = values[field.key];
  const hasErr = errors[field.key];
  const minAttr = field.allowNegative ? '' : 'min="0"';
  const stepAttr = field.integer ? 'step="1"' : 'step="0.01"';
  const placeholder = field.integer ? '人' : '元';
  const stagePartsAttr = field.stageParts ? ` data-stage-parts="${attr(field.stageParts.join(','))}"` : '';
  const stageClass = field.stageParts ? ' stage-field hidden' : '';
  return `<div class="field${stageClass}"${stagePartsAttr}>
    <label for="f_${field.key}">${escapeHtml(field.label)}${field.required ? ' <span style="color:#e24b4a">*</span>' : ''}</label>
    <input type="number" inputmode="${field.integer ? 'numeric' : 'decimal'}" ${stepAttr} ${minAttr} id="f_${field.key}" name="${field.key}"
      value="${val == null ? '' : attr(val)}" class="${hasErr ? 'err' : ''}" placeholder="${placeholder}">
    ${field.hint ? `<div class="hint">${escapeHtml(field.hint)}</div>` : ''}
    ${hasErr ? `<div class="err-msg">${escapeHtml(hasErr)}</div>` : ''}
  </div>`;
}

function toggleField(field, values, errors) {
  const on = values[field.key] === true || values[field.key] === 'on' || values[field.key] === '1';
  const amountsHtml = (field.amounts || []).map((amt) => {
    const val = values[amt.key];
    const hasErr = errors[amt.key];
    return `<div class="field" style="margin-bottom:8px">
      <label for="f_${amt.key}">${escapeHtml(amt.label)}</label>
      <input type="number" inputmode="decimal" step="0.01" min="0" id="f_${amt.key}" name="${amt.key}"
        value="${val == null ? '' : attr(val)}" class="${hasErr ? 'err' : ''}" placeholder="元">
      ${hasErr ? `<div class="err-msg">${escapeHtml(hasErr)}</div>` : ''}
    </div>`;
  }).join('');

  return `<div class="toggle" data-toggle="${field.key}">
      <span class="t-label">${escapeHtml(field.label)}</span>
      <label class="switch"><input type="checkbox" name="${field.key}" value="on" ${on ? 'checked' : ''}
        data-amount-target="amt_${field.key}"><span class="slider"></span></label>
    </div>
    ${amountsHtml ? `<div class="amount-box ${on ? '' : 'hidden'}" id="amt_${field.key}">${amountsHtml}</div>` : ''}`;
}

// 财务分区在“仅人员”采集范围（公办有报表校）下整体隐藏并禁用
const FINANCE_SECTION_IDS = ['income', 'expense', 'optional'];

function sectionHtml(section, values, errors) {
  const fields = CONTROL_FIELDS.filter((f) => f.section === section.id);
  if (fields.length === 0) return '';
  const inner = fields.map((f) => (f.type === 'number' ? numberInput(f, values, errors) : toggleField(f, values, errors))).join('');
  const stageNote = section.id === 'stageDetail'
    ? '<div class="sect-desc stage-section-note">请先在上方选择学校，系统会自动显示该校需要填报的学段。</div>'
    : `<div class="sect-desc">${escapeHtml(section.desc || '')}</div>`;
  const financeAttr = FINANCE_SECTION_IDS.includes(section.id) ? ' data-finance-section="1"' : '';
  return `<div class="card"${financeAttr}>
    <h2>${escapeHtml(section.title)}</h2>
    ${stageNote}
    ${inner}
  </div>`;
}

function metaHtml(values, errors) {
  const rows = META_FIELDS.map((f) => {
    const val = values[f.key];
    const hasErr = errors[f.key];
    if (f.type === 'textarea') {
      return `<div class="field"><label for="f_${f.key}">${escapeHtml(f.label)}</label>
        <textarea id="f_${f.key}" name="${f.key}" class="${hasErr ? 'err' : ''}">${escapeHtml(val || '')}</textarea>
        ${hasErr ? `<div class="err-msg">${escapeHtml(hasErr)}</div>` : ''}</div>`;
    }
    return `<div class="field"><label for="f_${f.key}">${escapeHtml(f.label)}${f.required ? ' <span style="color:#e24b4a">*</span>' : ''}</label>
      <input type="${f.type}" id="f_${f.key}" name="${f.key}" value="${attr(val || '')}" class="${hasErr ? 'err' : ''}"
        ${f.type === 'tel' ? 'inputmode="numeric" maxlength="11"' : ''}>
      ${hasErr ? `<div class="err-msg">${escapeHtml(hasErr)}</div>` : ''}</div>`;
  }).join('');
  return `<div class="card"><h2>填表人信息</h2><div class="sect-desc">用于核对和留痕，不对外公开</div>${rows}</div>`;
}

function formScript() {
  return `<script>
  document.querySelectorAll('[data-amount-target]').forEach(function(cb){
    cb.addEventListener('change',function(){
      var box=document.getElementById(cb.getAttribute('data-amount-target'));
      if(box){box.classList.toggle('hidden',!cb.checked);}
    });
  });
  var form=document.getElementById('collectForm');
  var overlay=document.getElementById('confirmOverlay');
  var numberLabels=${JSON.stringify(labelMap())};
  function fmt(n){return (Number(n)||0).toLocaleString('zh-CN');}
  function wageWarning(){
    // 教职工数直接取本表单填写值（事业年报已弃用，不再依赖名单推送的元数据）
    var staffEl=form.querySelector('[name="staffCount"]');
    var wageEl=form.querySelector('[name="wageTotal"]');
    var staff=staffEl?Number(staffEl.value):0;
    if(!staff||staff<=0||!wageEl||wageEl.value==='')return '';
    var per=Number(wageEl.value)/staff;
    if(!isFinite(per))return '';
    var msgs=[];
    if(per<15000||per>150000){
      msgs.push('按填写的教职工 '+staff+' 人测算，人均年工资约 '+fmt(Math.round(per))
        +' 元，明显偏'+(per<15000?'低':'高')
        +'。请确认填写的是【全年 · 全体教职工 · 含社保公积金】的总额，单位是元（不是万元、不是月工资）。');
    }
    var teacherEl=form.querySelector('[name="teacherCount"]');
    if(teacherEl&&Number(teacherEl.value)>staff){
      msgs.push('专任教师数（'+Number(teacherEl.value)+'）大于教职工总数（'+staff+'），请核对。');
    }
    if(msgs.length===0)return '';
    return '<div class="wage-warn">'+msgs.join('<br>')+'确认无误可继续提交。</div>';
  }
  var reviewBtn=document.getElementById('reviewBtn');
  if(reviewBtn)reviewBtn.addEventListener('click',function(){
    if(!form.reportValidity())return;
    var rows='';
    numberLabels.forEach(function(item){
      var el=form.querySelector('[name="'+item.key+'"]');
      if(!el)return;
      if(el.disabled)return;
      if(item.toggle){var t=form.querySelector('[name="'+item.toggle+'"]');if(!t||!t.checked)return;}
      var v=el.value===''?'0':el.value;
      rows+='<div class="sum-row"><span class="k">'+item.label+'</span><span class="v">'+fmt(v)+' '+(item.unit||'元')+'</span></div>';
    });
    document.getElementById('sumBody').innerHTML=rows||'<div class="muted">未填写任何金额</div>';
    var warnBox=document.getElementById('wageWarnBox');
    if(warnBox)warnBox.innerHTML=wageWarning();
    overlay.classList.add('show');
  });
  var editBtn=document.getElementById('editBtn');
  if(editBtn)editBtn.addEventListener('click',function(){overlay.classList.remove('show');});
  var submitBtn=document.getElementById('submitBtn');
  if(submitBtn)submitBtn.addEventListener('click',function(){
    this.disabled=true;this.textContent='提交中…';form.submit();
  });
  </script>`;
}

function collectFormHtml({
  school = null,
  schools = [],
  values = {},
  errors = {},
  lastVersion = 0,
  formAction = publicPath('/fill'),
  showSchoolPicker = false,
  formError = '',
} = {}) {
  const sections = CONTROL_SECTIONS.map((s) => sectionHtml(s, values, errors)).join('');

  const banner = lastVersion > 0
    ? `<div class="card" style="border-color:#f0c674;background:#fffaf0"><strong>本校已于此前提交过（第 ${lastVersion} 次）。</strong><div class="muted">如需更正，直接重新填写并提交即可，系统以最新一次为准。</div></div>`
    : '';

  const stageNames = [...new Set(schools.map((item) => String(item.stage || '未分类').trim() || '未分类'))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const selectedStage = school ? (String(school.stage || '未分类').trim() || '未分类') : '';
  const stageOptions = stageNames.map((stage) => `<option value="${attr(stage)}" ${stage === selectedStage ? 'selected' : ''}>${escapeHtml(stage)}</option>`).join('');
  const schoolMeta = {};
  for (const item of schools) {
    schoolMeta[item.fill_code] = {
      unitName: item.unit_name,
      stage: item.stage || '未分类',
      stageParts: stagePartsForSchoolStage(item.stage),
      mergeCenter: item.merge_center || '',
      isCenter: !!item.is_center,
      schoolCode: item.school_code || '',
      staffCount: item.staff_count || 0,
      scope: item.collect_scope === 'people' ? 'people' : 'full',
    };
  }
  const schoolPicker = showSchoolPicker
    ? `<div class="card">
        <h2>选择填报学校</h2>
        <div class="sect-desc">请先选择学段，再选择本校，填写采集年度本校账上的实际发生数。</div>
        <div class="school-picker two">
          <label>学段
            <select id="stageSelect" required>
              <option value="">请选择学段</option>
              ${stageOptions}
            </select>
          </label>
          <label>学校名称
            <select id="schoolSelect" name="fill_code" required disabled data-selected="${school ? attr(school.fill_code) : ''}">
              <option value="">请先选择学段</option>
            </select>
          </label>
        </div>
        ${errors.fill_code ? `<div class="err-msg" style="margin-top:8px">${escapeHtml(errors.fill_code)}</div>` : ''}
        <script type="application/json" id="schoolMetaJson">${jsonForScript(schoolMeta)}</script>
      </div>`
    : `<input type="hidden" name="fill_code" value="${school ? attr(school.fill_code) : ''}">`;

  const selectedText = school
    ? `填报单位：<strong>${escapeHtml(school.unit_name)}</strong>${school.merge_center && school.merge_center !== school.unit_name ? `<div class="muted" style="margin-top:4px">所属汇总：${escapeHtml(school.merge_center)}（请只填本单位账上的数）</div>` : ''}`
    : '请先选择学段和本校，再填写采集年度本校账上的实际发生数。';

  return `<h1>经费年报关键数采集</h1>
    ${formError ? `<div class="card" style="border-color:#f0c674;background:#fffaf0"><strong>${escapeHtml(formError)}</strong></div>` : ''}
    <form id="collectForm" method="post" action="${attr(formAction)}" novalidate>
      ${schoolPicker}
      <div class="locked" id="selectedSchoolNotice">${selectedText}</div>
    ${banner}
      ${sections}
      ${metaHtml(values, errors)}
      <button type="button" class="btn" id="reviewBtn">预览并提交</button>
      <div class="muted" style="text-align:center;margin-top:10px">金额单位：元。请如实填写本单位采集年度实际发生数。</div>
    </form>
  </div>
  <div class="overlay" id="confirmOverlay">
    <div class="sheet">
      <h2>请核对以下金额</h2>
      <div class="muted" style="margin-bottom:10px">提交后如发现有误，可重新打开本链接更正。</div>
      <div id="wageWarnBox"></div>
      <div id="sumBody"></div>
      <div style="height:16px"></div>
      <button type="button" class="btn" id="submitBtn">确认提交</button>
      <div style="height:8px"></div>
      <button type="button" class="btn btn-ghost" id="editBtn">返回修改</button>
    </div>
  </div>
  ${formScript()}`;
}

function unifiedFormPage({ year, schools, selectedSchool = null, values = {}, errors = {}, lastVersion = 0, formError = '' }) {
  const selectScript = `<script>
  (function(){
    var stage=document.getElementById('stageSelect');
    var select=document.getElementById('schoolSelect');
    var notice=document.getElementById('selectedSchoolNotice');
    var metaNode=document.getElementById('schoolMetaJson');
    var meta={};
    try{meta=JSON.parse(metaNode?metaNode.textContent:'{}')}catch(e){meta={}}
    var selectedCode=select?select.getAttribute('data-selected'):'';
    function sortedEntries(){
      return Object.keys(meta).map(function(code){return {code:code,item:meta[code]};})
        .sort(function(a,b){return String(a.item.unitName||'').localeCompare(String(b.item.unitName||''),'zh-CN');});
    }
    function rebuildSchools(){
      if(!stage||!select)return;
      var chosen=stage.value;
      select.innerHTML='';
      var first=document.createElement('option');
      first.value='';
      first.textContent=chosen?'请选择本校':'请先选择学段';
      select.appendChild(first);
      select.disabled=!chosen;
      sortedEntries().forEach(function(entry){
        if((entry.item.stage||'未分类')!==chosen)return;
        var opt=document.createElement('option');
        opt.value=entry.code;
        opt.textContent=entry.item.unitName;
        if(selectedCode&&entry.code===selectedCode)opt.selected=true;
        select.appendChild(opt);
      });
      if(selectedCode&&select.value===selectedCode)selectedCode='';
      updateNotice();
      updateStageFields(meta[select.value]);
    }
    function updateStageFields(item){
      var parts=new Set((item&&item.stageParts)||[]);
      document.querySelectorAll('[data-stage-parts]').forEach(function(row){
        var rowParts=String(row.getAttribute('data-stage-parts')||'').split(',').filter(Boolean);
        var show=rowParts.some(function(part){return parts.has(part);});
        row.classList.toggle('hidden',!show);
        row.querySelectorAll('input,select,textarea').forEach(function(el){el.disabled=!show;});
      });
      var note=document.querySelector('.stage-section-note');
      if(note){
        if(!item)note.textContent='请先在上方选择学校，系统会自动显示该校需要填报的学段。';
        else note.textContent='当前学校类别：'+(item.stage||'未分类')+'。请填写下方显示的学段明细；没有的填 0。';
      }
      updateScopeSections(item);
    }
    function updateScopeSections(item){
      // 公办有报表校（scope=people）只填人员与学段明细，财务分区隐藏并禁用
      var peopleOnly=!!(item&&item.scope==='people');
      document.querySelectorAll('[data-finance-section]').forEach(function(card){
        card.classList.toggle('hidden',peopleOnly||!item);
        card.querySelectorAll('input,select,textarea').forEach(function(el){el.disabled=peopleOnly||!item;});
      });
    }
    function updateNotice(){
      if(!select||!notice)return;
      var item=meta[select.value];
      notice.textContent='';
      if(!item){
        notice.textContent=stage&&stage.value?'请继续选择本校，再填写本校账上的实际发生数。':'请先选择学段和本校，再填写本校账上的实际发生数。';
        updateStageFields(null);
        return;
      }
      notice.appendChild(document.createTextNode('填报单位：'));
      var strong=document.createElement('strong');
      strong.textContent=item.unitName;
      notice.appendChild(strong);
      if(item.mergeCenter&&item.mergeCenter!==item.unitName){
        var div=document.createElement('div');
        div.className='muted';
        div.style.marginTop='4px';
        div.textContent='所属汇总：'+item.mergeCenter+'（请只填本单位账上的数）';
        notice.appendChild(div);
      }
      if(item.scope==='people'){
        var scopeDiv=document.createElement('div');
        scopeDiv.className='muted';
        scopeDiv.style.marginTop='4px';
        scopeDiv.textContent='本校为有正式报表单位：只需填报人员与学生数，财务数据无需填写。';
        notice.appendChild(scopeDiv);
      }
      updateStageFields(item);
    }
    if(stage)stage.addEventListener('change',function(){selectedCode='';rebuildSchools();});
    if(select)select.addEventListener('change',updateNotice);
    rebuildSchools();
  })();
  </script>`;

  const body = `<div class="wrap wide">
    <div class="year-note">
      <strong>请填写【${escapeHtml(year)}】年度数据</strong>
    </div>
    <div id="fillFormCard">
      ${collectFormHtml({
        school: selectedSchool,
        schools,
        values,
        errors,
        lastVersion,
        formAction: publicPath('/fill'),
        showSchoolPicker: true,
        formError,
      })}
    </div>
  </div>${selectScript}`;

  return layout('经费年报统一填报', body);
}

// 汇总预览用的字段标签映射（含 toggle 门控；人数字段单位为“人”）
function labelMap() {
  const list = [];
  for (const f of CONTROL_FIELDS) {
    if (f.type === 'number') list.push({ key: f.key, label: f.label, unit: f.integer ? '人' : '元' });
    for (const amt of f.amounts || []) list.push({ key: amt.key, label: amt.label, toggle: f.key, unit: '元' });
  }
  return list;
}

function successPage(school, version) {
  const body = `<div class="wrap">
    <div class="card" style="text-align:center">
      <div class="ok-icon">&#10003;</div>
      <h1>提交成功</h1>
      <p class="muted">${escapeHtml(school.unit_name)} 的关键数已提交（第 ${version} 次）。</p>
      <p class="muted">如需更正，重新进入统一填报页，选择本校后重新提交即可，系统以最新一次为准。</p>
      <div style="height:12px"></div>
      <a class="btn btn-ghost" href="${escapeHtml(publicUnifiedFillUrl())}" style="text-decoration:none;line-height:1.2">重新填写 / 更正</a>
    </div>
  </div>`;
  return layout('提交成功', body);
}

function notFoundPage() {
  return layout('链接无效', `<div class="wrap"><div class="card"><h1>链接无效</h1><p class="muted">该填表链接不存在或已失效，请向经办人索取本单位的最新链接。</p></div></div>`);
}

function adminLoginPage(error = '') {
  const body = `<div class="wrap"><div class="card">
    <h1>采集进度看板</h1>
    <form method="post" action="${escapeHtml(publicPath('/admin/login'))}">
      <div class="field"><label for="token">管理令牌</label>
        <input type="password" id="token" name="token" autocomplete="current-password"></div>
      ${error ? `<div class="err-msg" style="margin-bottom:10px">${escapeHtml(error)}</div>` : ''}
      <button class="btn" type="submit">进入</button>
    </form>
  </div></div>`;
  return layout('登录 · 采集看板', body);
}

function statusBadge(sub) {
  return sub
    ? `<span class="badge b-done">已填 · 第${sub.version}次</span>`
    : `<span class="badge b-wait">未填</span>`;
}

// 标注采集状态 + 切换按钮（enable-full / enable-people / disable）
function collectCell(school) {
  const enabled = Number(school.collect_enabled) === 1;
  const scope = school.collect_scope === 'people' ? 'people' : 'full';
  const label = !enabled
    ? '<span class="badge b-wait">未采集</span>'
    : (scope === 'people'
      ? '<span class="badge b-done">采集·仅人员</span>'
      : '<span class="badge b-done">采集·全部</span>');
  const btn = (action, text) => `<form method="post" action="${escapeHtml(publicPath('/admin/collect'))}" style="display:inline">
      <input type="hidden" name="id" value="${attr(school.id)}">
      <input type="hidden" name="action" value="${attr(action)}">
      <button type="submit" class="mini-btn">${escapeHtml(text)}</button>
    </form>`;
  const buttons = enabled
    ? btn('disable', '取消采集')
    : `${btn('enable-full', '采集·全部')} ${btn('enable-people', '采集·仅人员')}`;
  return `${label}<div class="collect-actions">${buttons}</div>`;
}

function adminDashboard({ year, groups, independents, stats }) {
  const rowFor = (school, sub) => `<tr>
      <td>${escapeHtml(school.unit_name)}</td>
      <td>${escapeHtml(school.stage || '未分类')}</td>
      <td>${statusBadge(sub)}</td>
      <td>${collectCell(school)}</td>
      <td>${sub ? escapeHtml(sub.filler_name || '') : ''}</td>
      <td>${sub ? escapeHtml(sub.filler_phone || (school.contact || '')) : escapeHtml(school.contact || '')}</td>
      <td>${sub ? escapeHtml(sub.created_at) : ''}</td>
      <td><a href="${escapeHtml(publicUnifiedFillUrl())}" target="_blank" rel="noreferrer">填写</a></td>
    </tr>`;
  const tableHead = '<thead><tr><th>单位</th><th>学段</th><th>状态</th><th>采集</th><th>填表人</th><th>电话</th><th>提交时间</th><th></th></tr></thead>';

  const groupHtml = groups.map((g) => {
    const rows = g.members.map((m) => rowFor(m.school, m.submission)).join('');
    const filled = g.members.filter((m) => m.submission).length;
    return `<div class="grp-title">合并组：${escapeHtml(g.center)}（${filled}/${g.members.length}）</div>
      <div class="card" style="padding:0;overflow:auto"><table>
      ${tableHead}
      <tbody>${rows}</tbody></table></div>`;
  }).join('');

  const indepRows = independents.map((m) => rowFor(m.school, m.submission)).join('');
  const indepHtml = independents.length
    ? `<div class="grp-title">独立单位（${independents.filter((m) => m.submission).length}/${independents.length}）</div>
       <div class="card" style="padding:0;overflow:auto"><table>
       ${tableHead}
       <tbody>${indepRows}</tbody></table></div>` : '';

  // 催报只统计已标注采集的单位
  const isCollecting = (m) => Number(m.school.collect_enabled) === 1;
  const unfilledNames = [
    ...groups.flatMap((g) => g.members.filter((m) => isCollecting(m) && !m.submission).map((m) => m.school.unit_name)),
    ...independents.filter((m) => isCollecting(m) && !m.submission).map((m) => m.school.unit_name),
  ];

  const body = `<div class="wrap">
    <h1>采集进度看板 · ${escapeHtml(Number(year) + 1)} 年采集 ${escapeHtml(year)} 年数据</h1>
    <div class="card">
      <div class="sum-row"><span class="k">单位总数</span><span class="v">${stats.total}</span></div>
      <div class="sum-row"><span class="k">已填报</span><span class="v">${stats.filled}</span></div>
      <div class="sum-row"><span class="k">未填报</span><span class="v">${stats.total - stats.filled}</span></div>
    </div>
    <div class="card">
      <h2>统一填报入口</h2>
      <div class="sect-desc">所有幼儿园共用这一个表单，进入后选择学校再填写。</div>
      <a class="btn" href="${escapeHtml(publicUnifiedFillUrl())}" target="_blank" rel="noreferrer">打开统一填报页</a>
    </div>
    <div class="card">
      <h2>未填报名单（催报用）</h2>
      <textarea readonly style="min-height:72px">${escapeHtml(unfilledNames.join('、') || '全部已填报')}</textarea>
    </div>
    ${groupHtml}
    ${indepHtml}
  </div>`;
  return layout('采集看板', body);
}

let _publicBaseUrl = '';
function setPublicBaseUrl(url) { _publicBaseUrl = String(url || '').replace(/\/+$/, ''); }
function publicPath(pathname) {
  const path = String(pathname || '/');
  try {
    const prefix = new URL(_publicBaseUrl).pathname.replace(/\/+$/, '');
    return `${prefix}${path}` || path;
  } catch {
    return path;
  }
}
function publicUnifiedFillUrl() { return `${_publicBaseUrl}/fill`; }

module.exports = {
  escapeHtml,
  unifiedFormPage,
  successPage,
  notFoundPage,
  adminLoginPage,
  adminDashboard,
  setPublicBaseUrl,
  publicPath,
  publicUnifiedFillUrl,
};
