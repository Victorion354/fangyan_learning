/* 一声一味 · 运行配置
 *
 * 天地图 Web 端 Key：
 *   1. 打开 https://lbs.tianditu.gov.cn/ 注册并申请“浏览器端”Key；
 *   2. 把 Key 填到下面的 tiandituKey；
 *   3. 未填写时，页面不会加载任何未授权底图，会自动显示离线示意。
 *   4. 天地图控制台的域名白名单不接受 localhost / 127.0.0.1。
 *      本地调试可改用 http://lvh.me:8787/（或 http://127.0.0.1.nip.io:8787/）访问，
 *      并把 lvh.me 加入白名单。
 *
 * 审图号：天地图标准地图数据 GS(2024)0650号。
 */
window.FANGYAN_CONFIG = {
  tiandituKey: '9c7bcb23888687a2a58eea54d9494104',
  apiBase: '',
  map: {
    attribution: '&copy; <a href="https://www.tianditu.gov.cn/" target="_blank" rel="noopener">天地图</a> · 标准地图数据审图号 GS(2024)0650号',
    reviewNo: 'GS(2024)0650号'
  }
};
