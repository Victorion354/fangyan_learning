/* 一声一味 · 数据观察与保护行动共享内容
 *
 * 数据口径：
 * - 使用人口来自《中国语言地图集（第 2 版）》相关估算，人口基数为 2004 年。
 * - 青少年熟练度来自城市样本调查，样本口径不完全一致，不能外推整个方言区。
 * - 代际使用率为综合估算，用于呈现趋势方向，不是普查数据。
 * - 活力指数为编辑评分（0–100），仅用于本项目内部横向比较。
 */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.FANGYAN_INSIGHT = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    updated: '2026-11-08',
    national: {
      putonghuaRate2020: 80.72,
      putonghuaRate2000: 53.06,
      surveyPoints: 1712,
      languages: 123,
      totalSpeakersWan: 120689,
      totalSpeakersText: '约 12.07 亿'
    },
    periods: ['1950s', '1980s', '2000s', '2020s'],
    defaultTrend: ['guanhua', 'wuyu', 'minyu', 'yueyu', 'kejia'],
    dialects: [
      {
        id: 'beijing', slug: 'guanhua', name: '官话', full: '北方官话', color: '#B07C2A',
        speakersWan: 79858, share: 66.2, youth: 78, transmission: 82, publicUse: 92, documentation: 88,
        vitality: 83, level: '安全', trend: [97, 95, 91, 85],
        detail: 'fangyan-detail.html?d=beijing'
      },
      {
        id: 'taiyuan', slug: 'jinyu', name: '晋语', full: '晋语', color: '#6E5B8A',
        speakersWan: 6305, share: 5.2, youth: 38, transmission: 60, publicUse: 58, documentation: 64,
        vitality: 51, level: '脆弱', trend: [95, 90, 78, 60],
        detail: 'fangyan-detail.html?d=taiyuan'
      },
      {
        id: 'shanghai', slug: 'wuyu', name: '吴语', full: '吴语 · 沪语', color: '#2E726E',
        speakersWan: 7379, share: 6.1, youth: 22, transmission: 42, publicUse: 58, documentation: 78,
        vitality: 41, level: '明确濒危', trend: [94, 86, 70, 46],
        detail: 'fangyan-detail.html?d=shanghai'
      },
      {
        id: 'huizhou', slug: 'huiyu', name: '徽语', full: '徽语 · 皖南', color: '#2E5A48',
        speakersWan: 330, share: 0.3, youth: 18, transmission: 30, publicUse: 35, documentation: 45,
        vitality: 28, level: '严重濒危', trend: [92, 82, 62, 38],
        detail: 'fangyan-detail.html?d=huizhou'
      },
      {
        id: 'xiamen', slug: 'minyu', name: '闽南语', full: '闽语 · 闽南', color: '#2A5C8A',
        speakersWan: 7500, share: 6.2, youth: 30, transmission: 62, publicUse: 68, documentation: 72,
        vitality: 51, level: '脆弱', trend: [95, 90, 80, 64],
        detail: 'fangyan-detail.html?d=xiamen'
      },
      {
        id: 'guangzhou', slug: 'yueyu', name: '粤语', full: '广府粤语', color: '#C23E33',
        speakersWan: 5882, share: 4.9, youth: 55, transmission: 72, publicUse: 82, documentation: 76,
        vitality: 68, level: '脆弱', trend: [96, 92, 84, 70],
        detail: 'fangyan-detail.html?d=guangzhou'
      },
      {
        id: 'meizhou', slug: 'kejia', name: '客家话', full: '客家语', color: '#8A6A40',
        speakersWan: 4220, share: 3.5, youth: 22, transmission: 42, publicUse: 50, documentation: 70,
        vitality: 38, level: '明确濒危', trend: [93, 84, 68, 45],
        detail: 'fangyan-detail.html?d=meizhou'
      },
      {
        id: 'nanchang', slug: 'ganyu', name: '赣语', full: '赣语', color: '#3A7BA0',
        speakersWan: 4800, share: 4.0, youth: 32, transmission: 48, publicUse: 48, documentation: 60,
        vitality: 43, level: '明确濒危', trend: [95, 88, 74, 51],
        detail: 'fangyan-detail.html?d=nanchang'
      },
      {
        id: 'changsha', slug: 'xiangyu', name: '湘语', full: '湘语 · 新湘语', color: '#C24A5A',
        speakersWan: 3637, share: 3.0, youth: 30, transmission: 50, publicUse: 52, documentation: 66,
        vitality: 44, level: '明确濒危', trend: [95, 88, 75, 55],
        detail: 'fangyan-detail.html?d=changsha'
      },
      {
        id: 'nanning', slug: 'pinghua', name: '平话', full: '桂南平话', color: '#5E8A54',
        speakersWan: 778, share: 0.6, youth: 14, transmission: 30, publicUse: 30, documentation: 40,
        vitality: 25, level: '严重濒危', trend: [91, 80, 60, 32],
        detail: 'fangyan-detail.html?d=nanning'
      }
    ],
    cities: [
      { city: '南昌', dialect: '赣语', rate: 31.8 },
      { city: '上海', dialect: '吴语', rate: 22.4 },
      { city: '厦门', dialect: '闽语', rate: 19.3 },
      { city: '杭州', dialect: '吴语', rate: 9.2 },
      { city: '苏州', dialect: '吴语', rate: 2.2 }
    ],
    insights: [
      {
        stat: '80.72%',
        title: '共同语能力提升',
        text: '全国普通话普及率从 2000 年的 53.06% 升至 2020 年的 80.72%。共同语能力提升与方言代际衰减，正在同时发生。',
        source: '教育部，2021'
      },
      {
        stat: '2.2%',
        title: '城市青年的方言断层',
        text: '在苏州样本中，6–20 岁能熟练使用方言的比例仅为 2.2%；南昌为 31.8%。同一代人，不同的语言命运。',
        source: '陈芊茹，2025（转引）'
      },
      {
        stat: '66.2%',
        title: '官话的体量优势',
        text: '官话使用人口约占十大方言合计的 66.2%，但官话内部八种次方言的活力并不均衡，不能用一个平均数概括。',
        source: '中国语言地图集（第 2 版）'
      },
      {
        stat: '1,712',
        title: '记录刚刚开始',
        text: '语保工程一期完成 1712 个调查点，覆盖 123 种语言及主要方言。记录是保护的第一步，但远不是终点。',
        source: '教育部 · 国家语委，2020'
      }
    ],
    researchValues: [
      {
        title: '汉语史的活材料',
        text: '方言保留了大量古音、古词和古语法层次，是重建汉语历史的重要证据。很多在通话中已经消失的现象，仍然活在地方口音里。',
        example: '闽语、粤语、客家话保留入声韵尾；吴语老湘语保留全浊声母。'
      },
      {
        title: '移民与地方史的坐标',
        text: '方言的分布、接触与替换，记录着移民路线、族群互动、行政区划和交通变迁。一张方言地图，也是一张社会史地图。',
        example: '客家话随客家人迁徙扩散；闽语随海上贸易进入台湾与东南亚。'
      },
      {
        title: '地方文化的载体',
        text: '戏曲、曲艺、民歌、谚语、地名、菜名和亲属称谓，都依赖方言保存。语言一旦退场，依附其上的地方知识也会一起变薄。',
        example: '苏州评弹、粤剧、闽南南音、客家山歌都以方言为声腔基础。'
      },
      {
        title: '技术与未来的接口',
        text: '方言语音数据可以服务于语音识别、语音合成、语言康复、多语种交互和人文计算。记录得越早，未来可做的研究与应用越多。',
        example: '低资源方言的语音语料，是 AI 语音技术实现包容性的关键。'
      }
    ],
    challenges: [
      {
        title: '代际断层',
        text: '家庭是方言最重要的传承场，但很多孩子从幼儿园起就进入普通话环境。祖辈带养减少、父母主动改用普通话，都会让自然传承中断。',
        evidence: '城市样本中，6–20 岁能熟练使用方言的比例从南昌 31.8% 到苏州 2.2% 不等。'
      },
      {
        title: '城市化与人口流动',
        text: '迁徙、通婚、租房与就业重组了社区语言网络。熟人社会的方言场景被写字楼、商场和跨地域社交取代，方言的“日常必要性”下降。',
        evidence: '大城市的新移民家庭常以普通话作为家庭共同语，方言退到与长辈通话时使用。'
      },
      {
        title: '公共场景收缩',
        text: '学校、医院、政务、媒体等公共场景以国家通用语言文字为主。方言能出现的场合越少，孩子越难把它和“有用”联系起来。',
        evidence: '不少青少年能听懂方言，却缺少开口说的机会和自信。'
      },
      {
        title: '语言观念的压力',
        text: '“方言土”“影响学习”“没出息”等观念仍存在于部分家庭。语言态度会直接影响家长是否愿意和孩子说方言。',
        evidence: '广州调查显示，部分家长对粤语传承持悲观态度，尽管粤语整体仍具活力。'
      },
      {
        title: '记录与研究不足',
        text: '汉语方言内部差异极大，现有调查点仍难覆盖每一个村落和小片。很多濒危土话在完成系统记录之前就已经失去流利的最后一代使用者。',
        evidence: '语保工程一期完成 1712 个调查点，但方言内部的小片差异远不止这个数量。'
      },
      {
        title: '数字资源失衡',
        text: '网络上的方言内容不少，但多为娱乐化片段；系统词典、语法标注、长篇语料和可授权语音库仍然稀缺，且集中于少数强势方言。',
        evidence: '粤语、闽南语资源相对丰富，徽语、平话等小方言的数字能见度明显不足。'
      }
    ],
    principles: [
      {
        number: '01',
        title: '使用优先于展示',
        text: '把方言只放进博物馆和舞台，最多保住声音的样本，保不住语言的生命。真正的保护，是让它在家庭、社区、市场和屏幕里继续被使用。'
      },
      {
        number: '02',
        title: '社区是主体',
        text: '母语者不是被研究的对象，而是记录者、讲述者和决策者。保护项目应当尊重社区意愿、知识产权和数据授权。'
      },
      {
        number: '03',
        title: '记录与传播并重',
        text: '没有记录，保护会失去依据；没有传播，记录会留在抽屉里。学术记录、公共传播和日常使用需要形成闭环。'
      }
    ],
    paths: [
      {
        title: '家庭：把方言重新变成日常',
        claim: '最有效的传承，发生在饭桌边，而不是展厅里。',
        actions: [
          '设定固定的“方言时间”，例如每周三晚饭或周末与祖辈通话。',
          '让长辈用方言讲家族故事、菜谱、地名和老照片。',
          '亲子共读方言童谣、绕口令，允许孩子混用两种语言。'
        ],
        actors: '家庭 · 祖辈 · 社区志愿者',
        example: '“方言星期三”：晚饭时间全家只说方言，坚持一个月形成习惯。'
      },
      {
        title: '学校：让方言进入乡土教育',
        claim: '方言课程不必增加负担，它可以成为认识家乡的入口。',
        actions: [
          '开发方言童谣、地名故事、地方戏曲等校本课程，每学期少量课时。',
          '邀请母语者进课堂，做口述史、方言戏剧和发音工作坊。',
          '把方言与地理、历史、音乐、美术课程跨学科结合。'
        ],
        actors: '学校 · 教师 · 非遗传承人 · 高校',
        example: '梅州把客家童谣和山歌编入校本课程，让祖辈成为课堂讲述者。'
      },
      {
        title: '社区：重建可以开口的场景',
        claim: '语言需要场景，场景需要人。',
        actions: [
          '在社区中心、菜场、公园设立方言角、方言故事会。',
          '为长者做口述史采录，建立社区声音档案。',
          '用方言录制社区广播、导览和节庆活动主持。'
        ],
        actors: '居委会 · 社工 · 长者 · 本地商户',
        example: '“方言菜市场”：摊主用方言介绍食材，年轻人拿任务卡打卡。'
      },
      {
        title: '媒体：让方言变得好听、好看',
        claim: '年轻人不是不喜欢方言，而是缺少愿意看的内容。',
        actions: [
          '制作方言短剧、播客、动画配音和本地生活类节目。',
          '为方言内容配字幕，降低理解门槛，扩大受众。',
          '避免只把方言当笑料，呈现它的知识、情感与美感。'
        ],
        actors: '内容创作者 · 平台 · 电视台 · 文化机构',
        example: '粤语影视与短视频、沪语童谣节目、闽南语音乐继续吸引年轻受众。'
      },
      {
        title: '数字：把声音留下来，也传出去',
        claim: '记录不是终点，可检索、可学习、可再利用才是。',
        actions: [
          '建设方言语音地图、开放词典、跟读评测和分级学习材料。',
          '按村落和小片标注口音，保留内部差异，而不是只做一个大标签。',
          '建立清晰的授权与隐私机制，尊重讲述者和社区。'
        ],
        actors: '高校 · 技术团队 · 语保机构 · 社区',
        example: '闽南语语音地图：扫码听老人讲地名故事，并跟读打分。'
      },
      {
        title: '制度与产业：给方言合法的位置',
        claim: '保护需要稳定的资源，也需要避免过度表演化。',
        actions: [
          '在非遗、语言资源和文化生态保护区中纳入方言口传文化。',
          '为传承人、记录者和社区项目提供稳定的小额资助。',
          '发展方言文旅、方言出版和方言文创，让保护拥有可持续的经济基础。'
        ],
        actors: '政府部门 · 文化机构 · 企业 · 社区',
        example: '苏州以评弹为入口，把吴语放进剧场、博物馆和城市文化品牌。'
      }
    ],
    cases: [
      {
        place: '苏州', dialect: '吴语',
        title: '以评弹为入口，把吴语放回剧场',
        text: '苏州评弹学校、中国苏州评弹博物馆和社区书场，构成了一条从专业传承到公众体验的路径。游客可以听一场评弹，再顺着唱词认识苏州话的声调与词汇。',
        entry: '听一场评弹，跟读一段唱词',
        detail: 'fangyan-detail.html?d=shanghai'
      },
      {
        place: '上海', dialect: '吴语',
        title: '城市舞台上的沪语实验',
        text: '上海沪剧院、沪语童谣、沪剧进校园和电视沪语节目，让吴语在上海的公共文化空间里保持可见。关键不是让所有人都会说，而是让想学的人有地方学。',
        entry: '进一次剧场，学一首沪语童谣',
        detail: 'fangyan-detail.html?d=shanghai'
      },
      {
        place: '广州', dialect: '粤语',
        title: '流行文化反哺方言',
        text: '粤剧艺术博物馆、粤语讲古、粤语影视和短视频，让粤语同时拥有传统与现代两种入口。粤语的经验说明：文化产品可以为语言提供真实的使用需求。',
        entry: '看一部粤语电影，学一句地道俚语',
        detail: 'fangyan-detail.html?d=guangzhou'
      },
      {
        place: '厦门', dialect: '闽语',
        title: '生态保护区里的闽南语',
        text: '闽南文化生态保护区把语言、南音、歌仔戏、木偶戏和宗族民俗放在同一个保护框架里。中国闽台缘博物馆则提供了跨地域的闽南文化叙事。',
        entry: '听一段南音，逛一次闽台缘博物馆',
        detail: 'fangyan-detail.html?d=xiamen'
      },
      {
        place: '梅州', dialect: '客家',
        title: '把客家话写进城市名片',
        text: '中国客家博物馆、客家山歌、围屋文旅和嘉应学院的客家研究，让梅州形成了“研究—展示—教育—旅游”的组合。语言在这里不只是展品，也是城市身份的一部分。',
        entry: '逛博物馆，学一首客家山歌',
        detail: 'fangyan-detail.html?d=meizhou'
      }
    ],
    timeline: [
      { year: '1955', title: '全国文字改革会议', text: '推广普通话成为国家语言规划的重要任务，现代汉语规范化进入议程。' },
      { year: '1982', title: '“国家推广全国通用的普通话”写入宪法', text: '共同语能力建设获得宪法层面的制度基础，方言的使用空间随之改变。' },
      { year: '2000', title: '《国家通用语言文字法》施行', text: '国家通用语言文字的法定地位确立；方言等语言资源的保护逐渐成为公共议题。' },
      { year: '2015', title: '中国语言资源保护工程启动', text: '以调查点为单元，系统记录汉语方言和少数民族语言，建设中国语言资源库。' },
      { year: '2018', title: '《岳麓宣言》发布', text: '首届世界语言资源保护大会在长沙举行，倡导保护语言多样性、尊重语言权利。' },
      { year: '2020', title: '语保工程一期收官', text: '完成 1712 个调查点，覆盖 123 种语言及主要方言；全国普通话普及率达到 80.72%。' },
      { year: '2021', title: '“十四五”语言规划推进', text: '语保工程二期、方言文化传承、语言资源数字化和公共服务继续推进。' },
      { year: '2024', title: '方言内容重回公共视野', text: '短视频、播客、AI 语音和城市文旅，让方言以新的媒介形态被听见，也带来新的记录伦理问题。' }
    ],
    sources: [
      {
        title: '中国语言资源保护工程一期建设情况',
        publisher: '教育部 · 国家语委', year: '2020',
        note: '1712 个调查点、123 种语言及主要方言、中国语言资源库建设进展。',
        url: 'http://www.moe.gov.cn/fbh/live/2020/52038/mtbd/202006/t20200603_462235.html'
      },
      {
        title: '2020 年中国语言文字事业发展状况',
        publisher: '教育部', year: '2021',
        note: '全国普通话普及率 80.72%；2000 年为 53.06%。',
        url: 'http://www.moe.gov.cn/fbh/live/2021/53486/mtbd/202106/t20210602_535129.html'
      },
      {
        title: '中国语言地图集（第 2 版）· 汉语方言卷',
        publisher: '中国社会科学院语言研究所等', year: '2012',
        note: '十大方言区框架与使用人口估算；人口基数为 2004 年。'
      },
      {
        title: '汉语方言的代际传承与活态保护',
        publisher: '人民论坛', year: '2024',
        note: '青岛、宁德、客家幼儿园等代际使用案例；方言活态保护路径。'
      },
      {
        title: '2013 年上海市民语言应用能力调查报告',
        publisher: '上海市统计局', year: '2014',
        note: '上海市民上海话能力、使用场景与语言态度；不同调查口径下的数据需谨慎比较。'
      },
      {
        title: '广州人语言态度与粤语认同传承',
        publisher: '单韵鸣、李胜 ·《语言战略研究》', year: '2018',
        note: '广州人母语为单一粤语的比例随代际下降；粤语认同与使用场景变化。'
      },
      {
        title: '南方方言区青年语言态度与方言使用调查',
        publisher: '陈芊茹', year: '2025',
        note: '南昌、上海、厦门、杭州、苏州 6–20 岁方言熟练使用率数据转引；样本口径不一。',
        url: 'https://doi.org/10.12677/ml.2025.137765'
      },
      {
        title: '世界濒危语言地图',
        publisher: 'UNESCO', year: '2010 至今',
        note: '语言活力与濒危等级的国际评估框架；本项目活力指数为独立编辑评分。',
        url: 'https://www.unesco.org/languages-atlas/'
      },
      {
        title: '中国语言资源采录展示平台',
        publisher: '中国语言资源保护工程', year: '持续更新',
        note: '公开语言资源、调查点信息与部分方言音档。',
        url: 'https://zhongguoyuyan.cn/'
      },
      {
        title: '抢救濒危语言，一场与时间的赛跑',
        publisher: '新华网', year: '2022',
        note: '语保工程、濒危语言记录与母语者参与背景。'
      }
    ],
    checklist: [
      { id: 'talk', text: '每周和家里长辈用方言聊 10 分钟', hint: '不必追求标准，先让声音回到日常。' },
      { id: 'record', text: '录下一段家人的方言讲述', hint: '先征得同意，标好时间、地点和讲述者。' },
      { id: 'rhyme', text: '学一首方言童谣或一句本地谚语', hint: '童谣短、节奏强，最适合重新开口。' },
      { id: 'place', text: '用方言认识三个本地地名', hint: '地名里常藏着地形、迁徙和老故事。' },
      { id: 'voice', text: '在家庭群发一条方言语音', hint: '把“打字”换成“说话”，使用场景就活了。' },
      { id: 'watch', text: '看一部方言电影或一场地方戏', hint: '开字幕也没关系，先让耳朵熟悉。' },
      { id: 'community', text: '在社区提议一个“方言角”', hint: '一周一次，长者和孩子一起讲故事。' },
      { id: 'suggest', text: '给方言保护项目留一条具体建议', hint: '越具体，越容易被听见和采纳。' }
    ],
    methods: {
      speakers: '使用人口采用《中国语言地图集（第 2 版）》相关估算，人口基数为 2004 年。它不是 2026 年的实时统计，也不等同于“会听会说”的人数。',
      share: '方言占比 = 该方言使用人口 ÷ 十大方言使用人口合计。合计约 12.07 亿，仅用于结构比较，不代表全国总人口。',
      youth: '青少年熟练使用率来自城市样本调查，样本口径、年龄范围与“熟练”的定义并不完全一致，因此只适合做城市间对照，不能外推为整个方言区。',
      trend: '代际使用率为本项目基于公开调查、案例报道与语言活力研究做出的综合估算，用来呈现趋势方向，不是普查数据。图中数值不应被引用为官方统计。',
      vitality: '本项目活力指数 = 青少年熟练度 × 40% + 代际传承 × 30% + 公共场景 × 20% + 记录完备度 × 10%。四个分项均为编辑评分（0–100），仅用于横向比较。',
      places: '当前版本不提供在线学习地点地图，也不采集精确位置。社区只记录匿名会话标识、可选的家乡省份和留言内容；如后续接入地点目录，坐标将以 WGS84 存储并在展示时转换。',
      suggestions: '留言内容由访客提交，公开展示前会过滤控制字符与尖括号；联系方式不会公开。点赞数仅用于表达共鸣，不代表科学调查结果。'
    },
    quotes: [
      { text: '方言不是过去的回声，而是地方社会仍在使用的未来。', note: '本项目编辑寄语' },
      { text: '十里不同音，百里不同俗。', note: '中国民间谚语' }
    ]
  };
});
