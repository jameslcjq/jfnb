const assert = require('assert');
const { validateSubmission, validateControls } = require('../src/validation');

function baseValid() {
  return {
    staffCount: '10',
    teacherCount: '8',
    studentCount: '120',
    tuitionIncome: '120000',
    fiscalSubsidy: '0',
    wageTotal: '80000',
    capitalExpense: '0',
    filler_name: '张三',
    filler_phone: '13800138000',
  };
}

function testRequiredMissing() {
  const r = validateControls({ tuitionIncome: '100' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.fiscalSubsidy, '缺 fiscalSubsidy 应报错');
  assert.ok(r.errors.wageTotal, '缺 wageTotal 应报错');
  assert.ok(r.errors.capitalExpense, '缺 capitalExpense 应报错');
}

function testNegativeAndNaN() {
  const r = validateControls({ tuitionIncome: '-5', fiscalSubsidy: 'abc', wageTotal: '1', capitalExpense: '2' });
  assert.ok(r.errors.tuitionIncome.includes('负'));
  assert.ok(r.errors.fiscalSubsidy.includes('数字'));
}

function testToggleGatesAmount() {
  const on = validateControls({ ...numeric(), hasRent: 'on' });
  assert.strictEqual(on.ok, false, 'hasRent 打开但无金额应报错');
  assert.ok(on.errors.rentExpense);

  const withAmt = validateControls({ ...numeric(), hasRent: 'on', rentExpense: '3000' });
  assert.strictEqual(withAmt.ok, true);
  assert.strictEqual(withAmt.controls.rentExpense, 3000);
  assert.strictEqual(withAmt.controls.hasRent, true);

  const off = validateControls({ ...numeric(), rentExpense: '9999' });
  assert.strictEqual(off.controls.hasRent, false);
  assert.strictEqual(off.controls.rentExpense, 0, '开关关闭时金额应归零');
}

function testDonationTwoAmounts() {
  const r = validateControls({ ...numeric(), hasDonation: 'on', donationIncome: '500' });
  assert.strictEqual(r.ok, false, '捐赠开启但缺支出应报错');
  assert.ok(r.errors.donationExpense);
}

function testMeta() {
  const bad = validateSubmission({ ...numeric(), filler_name: '', filler_phone: '123' });
  assert.ok(bad.errors.filler_name);
  assert.ok(bad.errors.filler_phone);

  const good = validateSubmission(baseValid());
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.controls.tuitionIncome, 120000);
  assert.strictEqual(good.meta.filler_name, '张三');
}

function testOptionalDefaultsZero() {
  const r = validateControls(numeric());
  assert.strictEqual(r.controls.otherIncome, 0, '未填其他收入应默认 0');
  assert.strictEqual(r.controls.netBalance, 0, '未填结余应默认 0');
}

function testPeopleCounts() {
  // 人数必填
  const missing = validateControls({ tuitionIncome: '1', fiscalSubsidy: '0', wageTotal: '1', capitalExpense: '0' });
  assert.ok(missing.errors.staffCount, '缺教职工数应报错');
  assert.ok(missing.errors.teacherCount, '缺专任教师应报错');
  assert.ok(missing.errors.studentCount, '缺学生数应报错');

  // 必须是整数
  const decimal = validateControls({ ...numeric(), staffCount: '10.5' });
  assert.ok(decimal.errors.staffCount.includes('整数'), '人数不允许小数');

  const good = validateControls(numeric());
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.controls.staffCount, 10);
  assert.strictEqual(good.controls.teacherCount, 8);
  assert.strictEqual(good.controls.studentCount, 120);
}

function testNetBalanceAllowsNegative() {
  const deficit = validateControls({ ...numeric(), netBalance: '-5000' });
  assert.strictEqual(deficit.ok, true, '结余允许为负（亏空）');
  assert.strictEqual(deficit.controls.netBalance, -5000);

  const surplus = validateControls({ ...numeric(), netBalance: '12000.5' });
  assert.strictEqual(surplus.controls.netBalance, 12000.5);

  const other = validateControls({ ...numeric(), tuitionIncome: '-1' });
  assert.ok(other.errors.tuitionIncome, '其他金额仍不允许为负');
}

function numeric() {
  return {
    staffCount: '10', teacherCount: '8', studentCount: '120',
    tuitionIncome: '120000', fiscalSubsidy: '0', wageTotal: '80000', capitalExpense: '0',
  };
}

testRequiredMissing();
testNegativeAndNaN();
testToggleGatesAmount();
testDonationTwoAmounts();
testMeta();
testOptionalDefaultsZero();
testPeopleCounts();
testNetBalanceAllowsNegative();
console.log('All server validation tests passed.');
