const assert = require('assert');
const { validateSubmission, validateControls } = require('../src/validation');

function baseValid() {
  return {
    staffCount: '10',
    teacherCount: '8',
    externalLongTermStaffCount: '0',
    retiredStaffCount: '0',
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
  assert.ok(missing.errors.externalLongTermStaffCount, '缺编外长期聘用人员应报错');
  assert.ok(missing.errors.retiredStaffCount, '缺离退休人员应报错');

  // 必须是整数
  const decimal = validateControls({ ...numeric(), staffCount: '10.5' });
  assert.ok(decimal.errors.staffCount.includes('整数'), '人数不允许小数');

  const good = validateControls(numeric());
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.controls.staffCount, 10);
  assert.strictEqual(good.controls.teacherCount, 8);
  assert.strictEqual(good.controls.studentCount, 120);

  const tooManyTeachers = validateControls({
    ...numeric(),
    teacherCount: '11',
    kindergartenStudentCount: '120',
    preschoolOneYearEndCount: '40',
    nurseryEndCount: '0',
  }, { stage: '幼儿园' });
  assert.ok(tooManyTeachers.errors.teacherCount.includes('不能大于'), '教学人员不得超过在职教职工');
}

function testStageDetailCounts() {
  const base = numeric();
  const missingJunior = validateControls({
    ...base,
    primaryStudentCount: '80',
    primaryInclusiveStudentCount: '0',
    primaryBoardingStudentCount: '0',
  }, { stage: '九年制学校' });
  assert.strictEqual(missingJunior.ok, false, '九年制应要求小学部和初中部明细');
  assert.ok(missingJunior.errors.juniorStudentCount, '九年制缺初中部学生数应报错');
  assert.strictEqual(missingJunior.errors.seniorStudentCount, undefined, '九年制不应要求高中部');

  const kindergarten = validateControls({
    ...base,
    kindergartenStudentCount: '120',
    preschoolOneYearEndCount: '40',
    nurseryEndCount: '0',
  }, { stage: '幼儿园' });
  assert.strictEqual(kindergarten.ok, true);
  assert.strictEqual(kindergarten.controls.schoolStage, '幼儿园', '应在 controls 中保留规范化学段');
  assert.strictEqual(kindergarten.controls.primaryStudentCount, 0, '幼儿园不适用小学部字段应归零');
  assert.strictEqual(kindergarten.controls.preschoolOneYearEndCount, 40);

  const mismatch = validateControls({
    ...base,
    primaryStudentCount: '80',
    primaryInclusiveStudentCount: '2',
    primaryBoardingStudentCount: '10',
    juniorStudentCount: '30',
    juniorInclusiveStudentCount: '1',
    juniorBoardingStudentCount: '5',
  }, { stage: ' 九年制学校 ' });
  assert.ok(mismatch.errors.studentCount.includes('明细合计 110'), '各适用学段合计必须等于学生数合计');
  assert.strictEqual(mismatch.controls.schoolStage, '九年制学校', '学段首尾空白应被规范化');

  const validMultiStage = validateControls({
    ...base,
    primaryStudentCount: '80',
    primaryInclusiveStudentCount: '2',
    primaryBoardingStudentCount: '10',
    juniorStudentCount: '40',
    juniorInclusiveStudentCount: '1',
    juniorBoardingStudentCount: '5',
  }, { stage: '九年制学校' });
  assert.strictEqual(validMultiStage.ok, true, '多学段人数之和与总数一致时应通过');

  const oversizedSubitems = validateControls({
    ...base,
    kindergartenStudentCount: '120',
    preschoolOneYearEndCount: '121',
    nurseryEndCount: '122',
  }, { stage: '幼儿园' });
  assert.ok(oversizedSubitems.errors.preschoolOneYearEndCount.includes('不能大于'));
  assert.ok(oversizedSubitems.errors.nurseryEndCount.includes('不能大于'));
}

function testStageRequiredForRealSubmission() {
  const legacy = validateControls(numeric());
  assert.strictEqual(legacy.ok, true, '未传 stage 属性的纯 controls 校验应保持兼容');
  assert.strictEqual(legacy.controls.schoolStage, undefined);

  const missing = validateControls(numeric(), { stage: null });
  assert.ok(missing.errors.schoolStage.includes('未配置'), '真实提交缺少学段应显式报错');

  const unknown = validateControls(numeric(), { stage: '其他学校' });
  assert.ok(unknown.errors.schoolStage.includes('不受支持'), '未知学段应显式报错');
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
    staffCount: '10', teacherCount: '8', externalLongTermStaffCount: '0', retiredStaffCount: '0', studentCount: '120',
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
testStageDetailCounts();
testStageRequiredForRealSubmission();
testNetBalanceAllowsNegative();
console.log('All server validation tests passed.');
