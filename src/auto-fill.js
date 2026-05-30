/**
 * auto-fill.js - 自动填报模块
 * 功能：验证码 OCR 识别 + 自动登录 + 自动填写报表
 */

const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// ===== 学校账号管理 =====
const ACCOUNTS_FILE = () => path.join(app.getPath('userData'), 'school_accounts.json');

/**
 * 读取所有学校账号
 */
function loadAccounts() {
  try {
    const filePath = ACCOUNTS_FILE();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * 保存学校账号列表
 */
function saveAccounts(accounts) {
  fs.writeFileSync(ACCOUNTS_FILE(), JSON.stringify(accounts, null, 2), 'utf-8');
}

/**
 * 添加或更新学校账号
 */
function upsertAccount(unitName, username, password) {
  const accounts = loadAccounts();
  const existing = accounts.find(a => a.unitName === unitName);
  if (existing) {
    existing.username = username;
    existing.password = password;
  } else {
    accounts.push({ unitName, username, password });
  }
  saveAccounts(accounts);
  return accounts;
}

/**
 * 删除学校账号
 */
function deleteAccount(unitName) {
  const accounts = loadAccounts().filter(a => a.unitName !== unitName);
  saveAccounts(accounts);
  return accounts;
}

// ===== 验证码 OCR 识别 =====

/**
 * 对验证码图片进行 OCR 识别
 * @param {Buffer|string} imageData - 图片 Buffer 或 base64 字符串
 * @returns {Promise<string>} 识别结果
 */
async function recognizeCaptcha(imageData) {
  try {
    // 如果是 base64 字符串，先转为 Buffer
    let buffer = imageData;
    if (typeof imageData === 'string') {
      // 去除 data:image/xxx;base64, 前缀
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    }

    const { data } = await Tesseract.recognize(buffer, 'eng', {
      // 验证码为纯数字
      tessedit_char_whitelist: '0123456789',
    });

    // 清理结果：只保留数字
    const result = data.text.replace(/[^0-9]/g, '').trim();
    return result;
  } catch (error) {
    console.error('验证码识别失败:', error.message);
    return '';
  }
}

// ===== 自动登录脚本 (注入 webview) =====

/**
 * 生成在 webview 内执行的登录脚本
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {string} captcha - 验证码识别结果
 */
function getLoginScript(username, password, captcha) {
  return `
    (function() {
      try {
        // 定位登录表单元素
        var userInput = document.querySelector('#userName') || 
                        document.querySelector('input[name="userName"]') ||
                        document.querySelector('input[name="username"]') ||
                        document.querySelector('#username') ||
                        document.querySelector('input[name="loginName"]');
        var passInput = document.querySelector('#password') || 
                        document.querySelector('input[name="password"]') ||
                        document.querySelector('input[type="password"]');
        var captchaInput = document.querySelector('#code') || 
                           document.querySelector('#captcha') ||
                           document.querySelector('#validateCode') ||
                           document.querySelector('#validatecode') ||
                           document.querySelector('#verifyCode') ||
                           document.querySelector('#verifycode') ||
                           document.querySelector('input[name="code"]') ||
                           document.querySelector('input[name="captcha"]') ||
                           document.querySelector('input[name="validateCode"]') ||
                           document.querySelector('input[name="validatecode"]') ||
                           document.querySelector('input[name="verifyCode"]') ||
                           document.querySelector('input[name="verifycode"]');
        if (!captchaInput) {
          captchaInput = Array.prototype.slice.call(document.querySelectorAll('input')).find(function(inp) {
            var key = ((inp.name || '') + ' ' + (inp.id || '') + ' ' + (inp.placeholder || '') + ' ' + (inp.className || '')).toLowerCase();
            return key.indexOf('verify') !== -1 || key.indexOf('captcha') !== -1 || key.indexOf('validate') !== -1 || key.indexOf('验证码') !== -1;
          }) || null;
        }

        // 调试：列出所有 input 元素
        var allInputs = [];
        document.querySelectorAll('input').forEach(function(inp) {
          allInputs.push(inp.type + ':' + (inp.name||inp.id||'?'));
        });

        if (!userInput || !passInput) {
          return JSON.stringify({ ok: false, message: '未找到用户名或密码输入框。页面inputs: ' + allInputs.join(', ') });
        }

        // 清空并填写
        userInput.value = '';
        userInput.focus();
        userInput.value = ${JSON.stringify(username)};
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        userInput.dispatchEvent(new Event('change', { bubbles: true }));

        passInput.value = '';
        passInput.focus();
        passInput.value = ${JSON.stringify(password)};
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('change', { bubbles: true }));

        if (captchaInput && ${JSON.stringify(captcha)}) {
          captchaInput.focus();
          var proto = Object.getPrototypeOf(captchaInput);
          var desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          if (desc && desc.set) {
            desc.set.call(captchaInput, ${JSON.stringify(captcha)});
          } else {
            captchaInput.value = ${JSON.stringify(captcha)};
          }
          captchaInput.setAttribute('value', ${JSON.stringify(captcha)});
          ['input','change','keyup','blur'].forEach(function(type) {
            captchaInput.dispatchEvent(new Event(type, { bubbles: true }));
          });
        }

        return JSON.stringify({ 
          ok: true, 
          message: '已填写登录信息',
          hasUser: !!userInput,
          hasPass: !!passInput,
          hasCaptcha: !!captchaInput,
          inputs: allInputs
        });
      } catch (e) {
        return JSON.stringify({ ok: false, message: e.message });
      }
    })();
  `;
}

/**
 * 生成获取验证码图片 URL 的脚本（不使用 canvas，避免跨域问题）
 */
function getCaptchaImageScript() {
  return `
    (function() {
      try {
        var img = document.querySelector('img[src*="captcha"]') || 
                  document.querySelector('img[src*="code"]') ||
                  document.querySelector('img[src*="verifyCode"]') ||
                  document.querySelector('img[src*="validateCode"]') ||
                  document.querySelector('img[src*="kaptcha"]') ||
                  document.querySelector('#codeImg') || 
                  document.querySelector('#captchaImg') ||
                  document.querySelector('.captcha-img') ||
                  document.querySelector('img[alt*="验证码"]') ||
                  document.querySelector('img[title*="验证码"]');

        if (!img) {
          // 列出页面上所有 img 标签的 src 供调试
          var allImgs = [];
          document.querySelectorAll('img').forEach(function(i) { 
            allImgs.push(i.src || i.getAttribute('src') || '(no src)'); 
          });
          return JSON.stringify({ ok: false, message: '未找到验证码图片。页面img: ' + allImgs.join(', ') });
        }

        var src = img.src || img.getAttribute('src');
        return JSON.stringify({ ok: true, src: src, type: 'url' });
      } catch (e) {
        return JSON.stringify({ ok: false, message: e.message });
      }
    })();
  `;
}

/**
 * 通过 Node.js 下载验证码图片（服务端请求，绕过跨域）
 * @param {string} captchaUrl - 验证码图片的完整 URL
 * @param {string} [cookie] - 可选的 Cookie 字符串
 * @returns {Promise<Buffer>} 图片 Buffer
 */
function downloadCaptchaImage(captchaUrl, cookie) {
  const https = require('https');
  const http = require('http');

  return new Promise((resolve, reject) => {
    const mod = captchaUrl.startsWith('https') ? https : http;
    const options = {
      headers: {},
      rejectUnauthorized: false, // 某些政务网站证书可能有问题
    };
    if (cookie) {
      options.headers['Cookie'] = cookie;
    }
    options.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    mod.get(captchaUrl, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * 生成点击登录按钮的脚本
 */
function getSubmitLoginScript() {
  return `
    (function() {
      try {
        var btn = document.querySelector('#loginBtn') ||
                  document.querySelector('button[type="submit"]') ||
                  document.querySelector('input[type="submit"]') ||
                  document.querySelector('.login-btn') ||
                  document.querySelector('.btn-login') ||
                  document.querySelector('a.login') ||
                  document.querySelector('button.btn-primary') ||
                  document.querySelector('.loginBtn');

        if (!btn) {
          // 调试：列出所有按钮
          var allBtns = [];
          document.querySelectorAll('button, input[type="submit"], a.btn').forEach(function(b) {
            allBtns.push((b.tagName||'') + ':' + (b.textContent||b.value||'').trim().substring(0,10));
          });
          return JSON.stringify({ ok: false, message: '未找到登录按钮。页面按钮: ' + allBtns.join(', ') });
        }

        btn.click();
        return JSON.stringify({ ok: true, message: '已点击登录按钮: ' + (btn.textContent||btn.value||'').trim() });
      } catch (e) {
        return JSON.stringify({ ok: false, message: e.message });
      }
    })();
  `;
}

/**
 * 检测是否登录成功（页面已跳转离开登录页）
 */
function getCheckLoginStatusScript() {
  return `
    (function() {
      var url = window.location.href;
      var isLoginPage = url.indexOf('login') !== -1;
      var errorMsg = document.querySelector('.error-msg') || 
                     document.querySelector('.alert-danger') || 
                     document.querySelector('.login-error') ||
                     document.querySelector('.layui-layer-content');
      return JSON.stringify({
        url: url,
        isLoginPage: isLoginPage,
        hasError: !!errorMsg,
        errorText: errorMsg ? errorMsg.textContent.trim().substring(0, 100) : ''
      });
    })();
  `;
}

module.exports = {
  loadAccounts,
  saveAccounts,
  upsertAccount,
  deleteAccount,
  recognizeCaptcha,
  downloadCaptchaImage,
  getLoginScript,
  getCaptchaImageScript,
  getSubmitLoginScript,
  getCheckLoginStatusScript,
};
