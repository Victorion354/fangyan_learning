/* ===== 数据：十大方言 ===== */
var DIALECTS=FANGYAN_DATA.dialects;

/* ===== 数据：词汇（每地十词） ===== */
var WORDS={
 beijing:[
  {w:'遛弯儿', py:'liù wānr',   std:'散步',     ex:'吃完了去遛遛弯儿。', tag:'动作'},
  {w:'得嘞',   py:'dé lei',     std:'好的、行', ex:'得嘞，我这就去办。',   tag:'应答'},
  {w:'瓷儿',   py:'cí er',      std:'好朋友、哥们', ex:'咱俩是发小儿，瓷得很。', tag:'称谓'},
  {w:'倍儿',   py:'bèi r',      std:'特别、非常', ex:'这店儿倍儿地道。',   tag:'程度'},
  {w:'盖了帽了',py:'gài le mào le', std:'好极了', ex:'这道菜盖了帽了！',   tag:'感叹'},
  {w:'磨叽',   py:'mò ji',      std:'拖拉、啰嗦', ex:'别磨叽了，快点。',   tag:'形容'},
  {w:'瞎掰',   py:'xiā bāi',    std:'胡说',     ex:'你净瞎掰。',           tag:'动词'},
  {w:'歇着',   py:'xiē zhe',    std:'休息',     ex:'你先歇着吧。',         tag:'动词'},
  {w:'胡同儿', py:'hú tòngr',   std:'小巷',     ex:'我住胡同儿里。',       tag:'名词'},
  {w:'溜达',   py:'liū da',     std:'散步、闲逛', ex:'出去溜达溜达。',     tag:'动作'}
 ],
 guangzhou:[
  {w:'食饭', py:'sik6 faan6',  std:'吃饭',       ex:'你食咗饭未呀？',   tag:'日常'},
  {w:'好靓', py:'hou2 leng3',  std:'很漂亮',     ex:'呢个女仔好靓。',   tag:'形容'},
  {w:'唔该', py:'m4 goi1',     std:'谢谢 / 劳驾', ex:'唔该，借借。',     tag:'礼貌'},
  {w:'早晨', py:'zou2 san4',   std:'早上好',     ex:'早晨，饮咗茶未？', tag:'问候'},
  {w:'犀利', py:'sai1 lei6',   std:'厉害',       ex:'佢好犀利！',       tag:'形容'},
  {w:'倾偈', py:'king1 gai2',  std:'聊天',       ex:'得闲一齐倾偈。',   tag:'动作'},
  {w:'屋企', py:'uk1 kei2',    std:'家',         ex:'我返屋企先。',     tag:'名词'},
  {w:'靓仔', py:'leng3 zai2',  std:'帅哥',       ex:'佢系个靓仔。',     tag:'称谓'},
  {w:'唔知', py:'m4 zi1',      std:'不知道',     ex:'我唔知佢去咗边。', tag:'应答'},
  {w:'好彩', py:'hou2 coi2',   std:'幸好',       ex:'好彩赶得及。',     tag:'副词'}
 ],
 shanghai:[
  {w:'侬好', py:'non ho',     std:'你好',     ex:'侬好，我是上海人。', tag:'问候'},
  {w:'白相', py:'beh shian',  std:'玩',       ex:'阿拉去外滩白相。',   tag:'动词'},
  {w:'阿拉', py:'a-la',       std:'我们',     ex:'阿拉是上海人。',     tag:'代词'},
  {w:'小囡', py:'siau noe',   std:'小孩',     ex:'小囡老乖个。',       tag:'称谓'},
  {w:'谢谢侬',py:'xia xia non',std:'谢谢你',   ex:'谢谢侬帮忙。',       tag:'礼貌'},
  {w:'交关', py:'jiau kue',   std:'很、非常', ex:'交关好。',           tag:'程度'},
  {w:'白相相',py:'beh shian shian', std:'玩玩', ex:'出去白相相。',     tag:'动作'},
  {w:'清爽', py:'chin san',   std:'干净',     ex:'屋里清爽来。',       tag:'形容'},
  {w:'辰光', py:'sen guan',   std:'时间',     ex:'辰光不早啦。',       tag:'名词'},
  {w:'蛮好', py:'me ho',      std:'挺好的',   ex:'蛮好个。',           tag:'应答'}
 ],
 xiamen:[
  {w:'甲奔', py:'jia bun',   std:'吃饭',       ex:'恁食饱未？',   tag:'日常'},
  {w:'歹势', py:'phái-sè',   std:'不好意思',   ex:'歹势，借过一下。', tag:'礼貌'},
  {w:'赞',   py:'tsán',      std:'棒、好',     ex:'真赞！',       tag:'感叹'},
  {w:'哇',   py:'góa',       std:'我',         ex:'哇去厦门玩。', tag:'代词'},
  {w:'恁',   py:'lín',       std:'你们',       ex:'恁食饱未？',   tag:'代词'},
  {w:'水',   py:'súi',       std:'漂亮',       ex:'真水！',       tag:'形容'},
  {w:'厝',   py:'chhù',      std:'房子、家',   ex:'哇厝在附近。', tag:'名词'},
  {w:'甲意', py:'kah-ì',     std:'喜欢',       ex:'哇真甲意。',   tag:'动词'},
  {w:'暗时', py:'àm-sî',     std:'晚上',       ex:'暗时来坐。',   tag:'时间'},
  {w:'好势', py:'hó-sè',     std:'妥当、行',   ex:'按呢好势。',   tag:'应答'}
 ],
 meizhou:[
  {w:'食朝', py:'siit zau',   std:'吃早饭', ex:'食朝了么？',       tag:'日常'},
  {w:'崖',   py:'ngai',       std:'我',     ex:'崖系客家人。',     tag:'代词'},
  {w:'汝',   py:'ngi',        std:'你',     ex:'汝食饱了么？',     tag:'代词'},
  {w:'食饭', py:'siit fan',   std:'吃饭',   ex:'崖去食饭。',       tag:'日常'},
  {w:'阿姆', py:'a mê',       std:'妈妈',   ex:'阿姆煮饭去。',     tag:'称谓'},
  {w:'几多', py:'gi do',      std:'多少',   ex:'几多钱？',         tag:'疑问'},
  {w:'冇',   py:'mo',         std:'没有',   ex:'崖冇钱。',         tag:'否定'},
  {w:'多谢', py:'do sia',     std:'谢谢',   ex:'多谢汝。',         tag:'礼貌'},
  {w:'好得', py:'ho det',     std:'幸好',   ex:'好得赶得及。',     tag:'副词'},
  {w:'转屋家',py:'zòn vuk ga',std:'回家',   ex:'崖转屋家去。',     tag:'动作'}
 ],
 changsha:[
  {w:'恰饭', py:'qia fan',  std:'吃饭',     ex:'恰饭了冒？',     tag:'日常'},
  {w:'妹陀', py:'mei duo',  std:'姑娘',     ex:'咯个妹陀好漂亮。', tag:'称谓'},
  {w:'娭毑', py:'āi jiě',   std:'奶奶',     ex:'娭毑屋里。',     tag:'称谓'},
  {w:'何解', py:'o gai',    std:'为什么',   ex:'何解咯样？',     tag:'疑问'},
  {w:'霸蛮', py:'ba man',   std:'倔强、硬撑', ex:'他霸蛮要去做。', tag:'形容'},
  {w:'里手', py:'li shou',  std:'内行',     ex:'他搞这个很里手。', tag:'形容'},
  {w:'崽',   py:'zei',      std:'儿子',     ex:'我崽读书去了。', tag:'称谓'},
  {w:'灵泛', py:'ling fan', std:'机灵',     ex:'咯伢子真灵泛。', tag:'形容'},
  {w:'韵味', py:'yun wei',  std:'有意思、有味道', ex:'咯歌好韵味。', tag:'形容'},
  {w:'扯皮', py:'che pi',   std:'纠缠、闹矛盾', ex:'莫扯皮咯。',   tag:'动作'}
 ],
 nanchang:[
  {w:'恰饭', py:'qia fan',   std:'吃饭',   ex:'恰饭去。',     tag:'日常'},
  {w:'渠',   py:'qie',       std:'他',     ex:'渠去南昌了。', tag:'代词'},
  {w:'冇',   py:'mao',       std:'没有',   ex:'冇得办法。',   tag:'否定'},
  {w:'细伢子',py:'xi ya zi', std:'小孩',   ex:'细伢子在读书。', tag:'称谓'},
  {w:'晓得', py:'xiao de',   std:'知道',   ex:'我晓得了。',   tag:'动词'},
  {w:'里厢', py:'li xiang',  std:'里面',   ex:'东西在里厢。', tag:'方位'},
  {w:'莫',   py:'mau',       std:'别、不要', ex:'莫走这么快。', tag:'否定'},
  {w:'蛮好', py:'man hao',   std:'挺好',   ex:'个只菜蛮好。', tag:'应答'},
  {w:'灶下', py:'zau ha',    std:'厨房',   ex:'渠在灶下。',   tag:'名词'},
  {w:'墨黑', py:'mei het',   std:'很黑',   ex:'屋里墨黑。',   tag:'形容'}
 ],
 taiyuan:[
  {w:'圪蹴', py:'ge jiu',   std:'蹲下',     ex:'圪蹴下歇歇。',     tag:'动作'},
  {w:'夜来', py:'ye lai',   std:'昨天',     ex:'夜来下雨了。',     tag:'时间'},
  {w:'后生', py:'hou seng', std:'小伙子',   ex:'那个后生真能干。', tag:'称谓'},
  {w:'婆姨', py:'po yi',    std:'妻子',     ex:'我婆姨在家。',     tag:'称谓'},
  {w:'甚',   py:'sen',      std:'什么',     ex:'你说甚了？',       tag:'疑问'},
  {w:'咋',   py:'za',       std:'怎么',     ex:'咋回事？',         tag:'疑问'},
  {w:'舒坦', py:'shu tan',  std:'舒服',     ex:'真舒坦！',         tag:'形容'},
  {w:'圪料', py:'ge liao',  std:'调皮、不乖', ex:'这娃娃真圪料。', tag:'形容'},
  {w:'孬',   py:'nao',      std:'坏、不好', ex:'这东西孬了。',     tag:'形容'},
  {w:'吃甚', py:'chi sen',  std:'吃什么',   ex:'今儿个吃甚了？',   tag:'日常'}
 ],
 huizhou:[
  {w:'今朝', py:'gin zao',  std:'今天',   ex:'今朝天气真好。',   tag:'时间'},
  {w:'明朝', py:'ming zao', std:'明天',   ex:'明朝再来。',       tag:'时间'},
  {w:'夜饭', py:'ya fan',   std:'晚饭',   ex:'食夜饭了。',       tag:'日常'},
  {w:'阿公', py:'a gong',   std:'爷爷',   ex:'阿公在屋里。',     tag:'称谓'},
  {w:'姆妈', py:'m ma',     std:'妈妈',   ex:'姆妈做饭去。',     tag:'称谓'},
  {w:'该里', py:'ge li',    std:'这里',   ex:'坐该里。',         tag:'方位'},
  {w:'几时', py:'ji si',    std:'什么时候', ex:'你几时来？',     tag:'疑问'},
  {w:'打雨', py:'da yu',    std:'下雨',   ex:'今朝要打雨。',     tag:'动作'},
  {w:'食饭', py:'shi fan',  std:'吃饭',   ex:'去食饭咯。',       tag:'日常'},
  {w:'蛮好', py:'man ho',   std:'挺好',   ex:'个样蛮好。',       tag:'应答'}
 ],
 nanning:[
  {w:'食饭', py:'sik faan', std:'吃饭',   ex:'食咗饭未？',     tag:'日常'},
  {w:'饮茶', py:'jam caa',  std:'喝茶',   ex:'去饮茶。',       tag:'日常'},
  {w:'乜嘢', py:'mat je',   std:'什么',   ex:'你做乜嘢？',     tag:'疑问'},
  {w:'边度', py:'bin dou',  std:'哪里',   ex:'你去边度？',     tag:'疑问'},
  {w:'多谢', py:'do ze',    std:'谢谢',   ex:'多谢你。',       tag:'礼貌'},
  {w:'系',   py:'si',       std:'是',     ex:'系咁样。',       tag:'动词'},
  {w:'唔好', py:'m hou',    std:'不好',   ex:'咁样唔好。',     tag:'形容'},
  {w:'快啲', py:'faai di',  std:'快点',   ex:'快啲来。',       tag:'副词'},
  {w:'靓',   py:'leng',     std:'漂亮',   ex:'真靓！',         tag:'形容'},
  {w:'我哋', py:'ngo dei',  std:'我们',   ex:'我哋去饮茶。',   tag:'代词'}
 ]
};

/* ===== 数据：同一句话 · 十句 ===== */
var SENTENCES=[
 {label:'你吃饭了吗？', rows:[
  {d:'普通话',ph:'你吃饭了吗？',py:'nǐ chī fàn le ma',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'吃了么您？',py:'chī le me nín',mean:'你吃了吗',color:'#B07C2A'},
  {d:'粤语',ph:'你食咗饭未呀？',py:'nei5 sik6 zo2 faan6 mei6 aa3',mean:'你吃(了)饭没有',color:'#C23E33'},
  {d:'吴语',ph:'侬饭吃过勒伐？',py:'non veh chi gu le va',mean:'你饭吃过没有',color:'#2E726E'},
  {d:'闽南语',ph:'汝食饱未？',py:'lí chia̍h pá bē',mean:'你吃(饱)没有',color:'#2A5C8A'},
  {d:'客家话',ph:'汝食饱了么？',py:'ngi siit páu le mo',mean:'你吃饱了吗',color:'#8A6A40'},
  {d:'湘语',ph:'恰饭了冒？',py:'qia fan le mao',mean:'吃饭了没有',color:'#C24A5A'},
  {d:'赣语',ph:'恰了饭啵？',py:'qia le fan bo',mean:'吃了饭吗',color:'#3A7BA0'},
  {d:'晋语',ph:'吃饭了没？',py:'chi fan le mei',mean:'你吃饭没有',color:'#6E5B8A'},
  {d:'徽语',ph:'饭食过了么？',py:'fan shi gu le mo',mean:'饭吃过了吗',color:'#2E5A48'},
  {d:'平话',ph:'食咗饭未？',py:'sik zo fan mei',mean:'吃了饭没有',color:'#5E8A54'}
 ]},
 {label:'谢谢', rows:[
  {d:'普通话',ph:'谢谢',py:'xiè xie',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'得嘞，谢您嘞',py:'dé lei, xiè nín le',mean:'谢谢您',color:'#B07C2A'},
  {d:'粤语',ph:'唔该晒',py:'m4 goi3 saai3',mean:'劳驾/多谢',color:'#C23E33'},
  {d:'吴语',ph:'谢谢侬',py:'xia xia non',mean:'谢你',color:'#2E726E'},
  {d:'闽南语',ph:'多谢 / 感恩',py:'to-siā / kám-siā',mean:'多谢/感恩',color:'#2A5C8A'},
  {d:'客家话',ph:'多谢',py:'do sia',mean:'多谢',color:'#8A6A40'},
  {d:'湘语',ph:'难为你啦',py:'lan wei ni la',mean:'麻烦你',color:'#C24A5A'},
  {d:'赣语',ph:'多谢多谢',py:'do xie do xie',mean:'多谢',color:'#3A7BA0'},
  {d:'晋语',ph:'麻烦啦',py:'ma fan la',mean:'麻烦你',color:'#6E5B8A'},
  {d:'徽语',ph:'多谢',py:'do xia',mean:'多谢',color:'#2E5A48'},
  {d:'平话',ph:'多谢',py:'do ze',mean:'多谢',color:'#5E8A54'}
 ]},
 {label:'真厉害 / 真棒', rows:[
  {d:'普通话',ph:'真厉害',py:'zhēn lì hai',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'盖了帽了',py:'gài le mào le',mean:'特别棒',color:'#B07C2A'},
  {d:'粤语',ph:'好犀利',py:'hou2 sai1 lei6',mean:'很厉害',color:'#C23E33'},
  {d:'吴语',ph:'结棍',py:'jik gun',mean:'厉害',color:'#2E726E'},
  {d:'闽南语',ph:'真赞',py:'tsin tsán',mean:'真棒',color:'#2A5C8A'},
  {d:'客家话',ph:'了唔得',py:'liáu m̀ tet',mean:'很了不得',color:'#8A6A40'},
  {d:'湘语',ph:'好韵味',py:'hao yun wei',mean:'真带劲',color:'#C24A5A'},
  {d:'赣语',ph:'蛮跩',py:'man zuai',mean:'很厉害',color:'#3A7BA0'},
  {d:'晋语',ph:'真展',py:'zen zan',mean:'很厉害',color:'#6E5B8A'},
  {d:'徽语',ph:'蛮来势',py:'man lai si',mean:'很厉害',color:'#2E5A48'},
  {d:'平话',ph:'好厉害',py:'hou lik hoi',mean:'很厉害',color:'#5E8A54'}
 ]},
 {label:'多少钱？', rows:[
  {d:'普通话',ph:'多少钱？',py:'duō shǎo qián',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'多少钱？',py:'duō shǎo qián',mean:'——',color:'#B07C2A'},
  {d:'粤语',ph:'几多钱？',py:'gei2 do1 cin2',mean:'多少钱',color:'#C23E33'},
  {d:'吴语',ph:'几钿？',py:'ji di',mean:'多少钱',color:'#2E726E'},
  {d:'闽南语',ph:'偌济钱？',py:'luā-tsē tsînn',mean:'多少钱',color:'#2A5C8A'},
  {d:'客家话',ph:'几多钱？',py:'gi do tshen',mean:'多少钱',color:'#8A6A40'},
  {d:'湘语',ph:'好多钱？',py:'hao do qien',mean:'多少钱',color:'#C24A5A'},
  {d:'赣语',ph:'几多钱？',py:'ji do qien',mean:'多少钱',color:'#3A7BA0'},
  {d:'晋语',ph:'多钱了？',py:'duo qian le',mean:'多少钱',color:'#6E5B8A'},
  {d:'徽语',ph:'几多钱？',py:'ji do zian',mean:'多少钱',color:'#2E5A48'},
  {d:'平话',ph:'几多钱？',py:'gei do cin',mean:'多少钱',color:'#5E8A54'}
 ]},
 {label:'你好', rows:[
  {d:'普通话',ph:'你好',py:'nǐ hǎo',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'您好',py:'nín hǎo',mean:'您好',color:'#B07C2A'},
  {d:'粤语',ph:'你好',py:'nei5 hou2',mean:'你好',color:'#C23E33'},
  {d:'吴语',ph:'侬好',py:'non ho',mean:'你好',color:'#2E726E'},
  {d:'闽南语',ph:'汝好',py:'lí hó',mean:'你好',color:'#2A5C8A'},
  {d:'客家话',ph:'汝好',py:'ngi ho',mean:'你好',color:'#8A6A40'},
  {d:'湘语',ph:'你好',py:'ni hao',mean:'你好',color:'#C24A5A'},
  {d:'赣语',ph:'你好',py:'ni hao',mean:'你好',color:'#3A7BA0'},
  {d:'晋语',ph:'你好',py:'ni hao',mean:'你好',color:'#6E5B8A'},
  {d:'徽语',ph:'你好',py:'ni ho',mean:'你好',color:'#2E5A48'},
  {d:'平话',ph:'你好',py:'nei hou',mean:'你好',color:'#5E8A54'}
 ]},
 {label:'去哪儿？', rows:[
  {d:'普通话',ph:'去哪儿？',py:'qù nǎ er',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'去哪儿？',py:'qù nǎr',mean:'——',color:'#B07C2A'},
  {d:'粤语',ph:'去边度？',py:'heoi3 bin1 dou6',mean:'去哪里',color:'#C23E33'},
  {d:'吴语',ph:'到阿里去？',py:'dau a li chi',mean:'去哪里',color:'#2E726E'},
  {d:'闽南语',ph:'去叨位？',py:'khì tó-uī',mean:'去哪里',color:'#2A5C8A'},
  {d:'客家话',ph:'去奈里？',py:'hi nai li',mean:'去哪里',color:'#8A6A40'},
  {d:'湘语',ph:'去哪里？',py:'qi na li',mean:'——',color:'#C24A5A'},
  {d:'赣语',ph:'去何里？',py:'qi he li',mean:'去哪里',color:'#3A7BA0'},
  {d:'晋语',ph:'去哪了？',py:'qi na le',mean:'——',color:'#6E5B8A'},
  {d:'徽语',ph:'到哪去？',py:'dau na qi',mean:'——',color:'#2E5A48'},
  {d:'平话',ph:'去边处？',py:'heoi bin syu',mean:'去哪里',color:'#5E8A54'}
 ]},
 {label:'再见', rows:[
  {d:'普通话',ph:'再见',py:'zài jiàn',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'回见',py:'huí jiàn',mean:'回头见',color:'#B07C2A'},
  {d:'粤语',ph:'再见 / 拜拜',py:'zoi3 gin3',mean:'再见',color:'#C23E33'},
  {d:'吴语',ph:'再会',py:'tse we',mean:'再见',color:'#2E726E'},
  {d:'闽南语',ph:'再会',py:'chài-hōe',mean:'再见',color:'#2A5C8A'},
  {d:'客家话',ph:'再见',py:'zai gian',mean:'再见',color:'#8A6A40'},
  {d:'湘语',ph:'再见',py:'zai gian',mean:'再见',color:'#C24A5A'},
  {d:'赣语',ph:'再见',py:'zai jian',mean:'再见',color:'#3A7BA0'},
  {d:'晋语',ph:'缓咱',py:'huan za',mean:'回头见',color:'#6E5B8A'},
  {d:'徽语',ph:'再会',py:'zai hui',mean:'再见',color:'#2E5A48'},
  {d:'平话',ph:'再见',py:'zoi gin',mean:'再见',color:'#5E8A54'}
 ]},
 {label:'等一下', rows:[
  {d:'普通话',ph:'等一下',py:'děng yí xià',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'等会儿',py:'děng huir',mean:'等一会儿',color:'#B07C2A'},
  {d:'粤语',ph:'等一阵',py:'dang2 jat1 zan6',mean:'等一下',color:'#C23E33'},
  {d:'吴语',ph:'等歇',py:'den xih',mean:'等一下',color:'#2E726E'},
  {d:'闽南语',ph:'等一下子',py:'tán chi̍t-ē',mean:'等一下',color:'#2A5C8A'},
  {d:'客家话',ph:'等一下',py:'den yit ha',mean:'等一下',color:'#8A6A40'},
  {d:'湘语',ph:'等一下',py:'den yi xa',mean:'等一下',color:'#C24A5A'},
  {d:'赣语',ph:'等一下',py:'den yi ha',mean:'等一下',color:'#3A7BA0'},
  {d:'晋语',ph:'稍等',py:'shao deng',mean:'稍等',color:'#6E5B8A'},
  {d:'徽语',ph:'等一下',py:'den yi ha',mean:'等一下',color:'#2E5A48'},
  {d:'平话',ph:'等一下',py:'dang jat ha',mean:'等一下',color:'#5E8A54'}
 ]},
 {label:'天气真好', rows:[
  {d:'普通话',ph:'天气真好',py:'tiān qì zhēn hǎo',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'天儿真不错',py:'tiānr zhēn búcuò',mean:'天气很好',color:'#B07C2A'},
  {d:'粤语',ph:'天气真系好',py:'tin1 hei3 zan1 hai6 hou2',mean:'天气真好',color:'#C23E33'},
  {d:'吴语',ph:'天气真当好',py:'tin qi zen don ho',mean:'天气真好',color:'#2E726E'},
  {d:'闽南语',ph:'天气真好',py:'thinn-khì tsin hó',mean:'天气真好',color:'#2A5C8A'},
  {d:'客家话',ph:'天气真好',py:'tien hi zin ho',mean:'天气真好',color:'#8A6A40'},
  {d:'湘语',ph:'天气真好',py:'tien qi zen hao',mean:'天气真好',color:'#C24A5A'},
  {d:'赣语',ph:'天气蛮好',py:'tien qi man hao',mean:'天气很好',color:'#3A7BA0'},
  {d:'晋语',ph:'日头好',py:'ri tou hao',mean:'天气好',color:'#6E5B8A'},
  {d:'徽语',ph:'天气真好',py:'tien qi zin ho',mean:'天气真好',color:'#2E5A48'},
  {d:'平话',ph:'天气真好',py:'tin hei zan hou',mean:'天气真好',color:'#5E8A54'}
 ]},
 {label:'明天见', rows:[
  {d:'普通话',ph:'明天见',py:'míng tiān jiàn',mean:'——',color:'#2B2C35'},
  {d:'官话',ph:'明儿见',py:'míngr jiàn',mean:'明天见',color:'#B07C2A'},
  {d:'粤语',ph:'听日见',py:'ting1 jat6 gin3',mean:'明天见',color:'#C23E33'},
  {d:'吴语',ph:'明朝会',py:'ming zao we',mean:'明天见',color:'#2E726E'},
  {d:'闽南语',ph:'明仔再会',py:'bîn-á-chài',mean:'明天见',color:'#2A5C8A'},
  {d:'客家话',ph:'天光日见',py:'tien gong ngit gian',mean:'明天见',color:'#8A6A40'},
  {d:'湘语',ph:'明天见',py:'min tian gian',mean:'明天见',color:'#C24A5A'},
  {d:'赣语',ph:'明日见',py:'ming nyit jian',mean:'明天见',color:'#3A7BA0'},
  {d:'晋语',ph:'明儿见',py:'ming er jian',mean:'明天见',color:'#6E5B8A'},
  {d:'徽语',ph:'明朝见',py:'ming zao jian',mean:'明天见',color:'#2E5A48'},
  {d:'平话',ph:'听日见',py:'ting jat gin',mean:'明天见',color:'#5E8A54'}
 ]}
];

/* ===== 数据：测验 · 十题 ===== */
var QUIZ=[
 {ph:'唔该晒！多谢你。',q:'这是哪里的方言？',options:['粤语','吴语','赣语','湘语'],answer:0,why:'“唔该”“多谢”都是粤语常用道谢语，“晒”表程度加深。'},
 {ph:'阿拉一道去白相。',q:'这是哪里的方言？',options:['徽语','闽南语','吴语','客家话'],answer:2,why:'“阿拉”“白相”是典型上海话（吴语），意为我们一起去玩。'},
 {ph:'真水！',q:'这是哪里的方言？',options:['闽南语','湘语','粤语','晋语'],answer:0,why:'闽南语“水”(súi) 意为漂亮、美，说人或物“真水”就是真好看。'},
 {ph:'崖系客家人。',q:'这是哪里的方言？',options:['赣语','客家话','平话','徽语'],answer:1,why:'“崖”(ngai) 是客家话的“我”，客家人常自称“崖”。'},
 {ph:'恰饭了冒？',q:'这是哪里的方言？',options:['湘语','粤语','官话','晋语'],answer:0,why:'湖南话说“恰”即“吃”，“恰饭”就是吃饭，“冒”表“没有”。'},
 {ph:'渠去南昌了。',q:'这是哪里的方言？',options:['平话','吴语','赣语','客家话'],answer:2,why:'赣语用“渠”作第三人称“他”，是古汉语的保留。'},
 {ph:'圪蹴下歇歇。',q:'这是哪里的方言？',options:['晋语','徽语','湘语','闽南语'],answer:0,why:'“圪蹴”(ge jiu) 是晋语（山西方言）的“蹲下”，极具特色。'},
 {ph:'今朝天气真好。',q:'这是哪里的方言？',options:['客家话','徽语','赣语','官话'],answer:1,why:'徽语说“今朝”表“今天”，在皖南徽州一带使用。'},
 {ph:'饮茶未？',q:'这是哪里的方言？',options:['平话','湘语','晋语','吴语'],answer:0,why:'桂南平话（南宁）用“饮茶”表喝茶/吃早茶，颇具岭南风味。'},
 {ph:'吃了么您？遛弯儿去。',q:'这是哪里的方言？',options:['官话','粤语','徽语','赣语'],answer:0,why:'“遛弯儿”“您”是典型的北京官话，儿化与敬称齐备。'}
];

/* ===== 数据：冷知识 ===== */
var FACTS=[
 {n:'10',t:'方言十支并立',c:'#B07C2A',c2:'#6E5B8A',d:'官话、粤、吴、闽、客、湘、赣、晋、徽、平话十支，彼此差异有时超过欧洲语言之间的距离。'},
 {n:'9', t:'粤语的声调',c:'#C23E33',c2:'#E2622B',d:'广府粤语多至九个声调，并保留古汉语“入声”，读古诗格外有韵。'},
 {n:'古',t:'闽南·活化石',c:'#2A5C8A',c2:'#3A7BA0',d:'“厝”（房子）、“鼎”（锅）等闽南语词汇沿用上千年，被称为古汉语活化石。'},
 {n:'浊',t:'吴语全浊声母',c:'#2E726E',c2:'#5AA6B5',d:'上海话等吴语保留 b/d/g 全浊声母，普通话中已基本消失。'},
 {n:'入',t:'晋语存入声',c:'#6E5B8A',c2:'#8A6A40',d:'晋语（山西）保留独立的入声韵，“圪”字头词极为丰富。'},
 {n:'迁',t:'客家·南迁话',c:'#8A6A40',c2:'#C24A5A',d:'客家话随客家人数次南迁而来，“崖”自称沿用至今，是流动的方言史。'}
];

/* ===== 工具 ===== */
function $(s,c){return (c||document).querySelector(s)}
function $$(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))}
var toastTimer=null;
function toast(msg){var t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('show')},2400)}
function speak(text,btn){
  if(btn){btn.classList.add('sounding');clearTimeout(btn._t);btn._t=setTimeout(function(){btn.classList.remove('sounding')},1800)}
  if(!('speechSynthesis' in window)){toast('当前浏览器不支持语音朗读');return}
  try{window.speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=.9;window.speechSynthesis.speak(u);toast('正在朗读（普通话合成音，非方言发音）：'+text)}
  catch(e){toast('语音朗读暂不可用')}
}

/* ===== 首屏 ===== */
function renderHero(){
  $('#bubbles').innerHTML = DIALECTS.map(function(d,i){
    return '<button type="button" class="bub" style="--c:'+d.color+';--d:'+(0.55+i*0.13).toFixed(2)+'s"><span class="bd">'+d.name+'</span><span class="bp">'+d.hi+'</span><span class="by">'+d.hipy+'</span><span class="sr-only">试听示例（普通话合成音）</span></button>';
  }).join('');
  $$('#bubbles .bub').forEach(function(b){b.addEventListener('click',function(){var t=b.querySelector('.bp');speak(t?t.textContent:'',b);b.classList.add('speaking');setTimeout(function(){b.classList.remove('speaking')},1800)})});
  var eq='';for(var i=0;i<22;i++){eq+='<span class="'+(i%2?'e':'')+'" style="--d:'+(i*0.08).toFixed(2)+'s"></span>'}
  $('#eq').innerHTML=eq;
}

/* ===== 十大方言 ===== */
function renderDialects(){
  $$('#d-cards .d-card').forEach(function(card){
    var id=card.getAttribute('data-id');
    var name=(card.querySelector('h3').firstChild.textContent||'').trim();
    card.setAttribute('role','link');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label','查看'+name+'详情');
    var go=document.createElement('span');go.className='d-go';go.textContent='详情 →';go.setAttribute('aria-hidden','true');
    card.appendChild(go);
    function openDetail(){window.open('fangyan-detail.html?d='+id,'_blank','noopener');}
    card.addEventListener('click',openDetail);
    card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail();}});
  });
}

/* ===== 词汇 ===== */
var curDialect='beijing';
function renderPills(){
  $('#v-pills').innerHTML = DIALECTS.map(function(d){
    return '<button type="button" class="v-pill'+(d.id===curDialect?' on':'')+'" data-id="'+d.id+'" aria-pressed="'+(d.id===curDialect)+'" style="--c:'+d.color+'"><span class="dot"></span>'+d.name+'</button>';
  }).join('');
  $$('#v-pills .v-pill').forEach(function(p){p.addEventListener('click',function(){selectDialect(p.getAttribute('data-id'))})});
}
function renderWords(){
  var d = DIALECTS.filter(function(x){return x.id===curDialect})[0];
  var words = WORDS[curDialect];
  $('#v-cards').innerHTML = words.map(function(w,i){
    var fav=!!(window.FANGYAN_LEARN&&window.FANGYAN_LEARN.isFavorite(curDialect,i));
    return '<div class="vcard" data-i="'+i+'" role="button" tabindex="0" aria-pressed="false" data-label="'+w.w+'，'+w.std+'" aria-label="'+w.w+'，'+w.std+'，未翻面，按下查看释义">'+
      '<div class="vcard-in">'+
        '<div class="vface vfront" style="--c:'+d.color+'">'+
          '<button type="button" class="vfav'+(fav?' on':'')+'" title="'+(fav?'取消收藏':'收藏这个词')+'" aria-label="'+(fav?'取消收藏':'收藏')+w.w+'" aria-pressed="'+(fav?'true':'false')+'" data-fav="'+i+'">'+(fav?'★':'☆')+'</button>'+
          '<button type="button" class="vplay" title="试听（普通话合成音）" aria-label="试听'+w.w+'（普通话合成音）" data-t="'+w.w+'"><span class="b"><i></i><i></i><i></i></span></button>'+
          '<p class="vt">'+d.name+' · 常用词</p>'+
          '<div class="vw">'+w.w+'</div>'+
          '<div class="vpy">'+w.py+'</div>'+
          '<span class="hint">点卡片看释义</span>'+
        '</div>'+
        '<div class="vface vback" style="--c:'+d.color+'">'+
          '<div class="vstd">'+w.std+'</div>'+
          '<p class="vex">'+w.ex+'</p>'+
          '<span class="vtag">'+w.tag+'</span>'+
          '<span class="vhint">点回正面</span>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
  $$('#v-cards .vcard').forEach(function(card){
    var i=Number(card.getAttribute('data-i'));
    var w=words[i]||{};
    function setFlip(on){
      card.classList.toggle('flipped',on);
      card.setAttribute('aria-pressed',on?'true':'false');
      card.setAttribute('aria-label',card.getAttribute('data-label')+(on?'，已翻面，按下返回正面':'，未翻面，按下查看释义'));
      if(on&&window.FANGYAN_LEARN)window.FANGYAN_LEARN.markLearned(curDialect,i,w.w,w.std);
    }
    card.addEventListener('click',function(e){if(e.target.closest('.vplay')||e.target.closest('.vfav'))return;setFlip(!card.classList.contains('flipped'))});
    card.addEventListener('keydown',function(e){
      if(e.target!==card)return;
      if(e.key==='Enter'||e.key===' '){e.preventDefault();setFlip(!card.classList.contains('flipped'));}
    });
    var btn=$('.vplay',card);
    btn.addEventListener('click',function(e){e.stopPropagation();speak(btn.getAttribute('data-t')||'',btn)});
    var fav=$('.vfav',card);
    if(fav&&window.FANGYAN_LEARN){
      fav.addEventListener('click',function(e){
        e.stopPropagation();
        var on=window.FANGYAN_LEARN.toggleFavorite(curDialect,i,w.w,w.std,w.py);
        fav.classList.toggle('on',on);
        fav.textContent=on?'★':'☆';
        fav.setAttribute('aria-pressed',on?'true':'false');
        fav.setAttribute('aria-label',(on?'取消收藏':'收藏')+w.w);
        fav.setAttribute('title',on?'取消收藏':'收藏这个词');
        toast(on?'已收藏「'+w.w+'」，可在「我的学习」复习':'已取消收藏');
      });
    }
  });
}
function selectDialect(id){
  curDialect=id;
  renderPills();
  renderWords();
}

/* ===== 同一句话 ===== */
var curSent=0;
function renderChips(){
  $('#c-chips').innerHTML = SENTENCES.map(function(s,i){
    return '<button type="button" class="c-chip'+(i===curSent?' on':'')+'" data-i="'+i+'" aria-pressed="'+(i===curSent)+'">'+s.label+'</button>';
  }).join('');
  $$('#c-chips .c-chip').forEach(function(ch){ch.addEventListener('click',function(){curSent=parseInt(ch.getAttribute('data-i'),10);renderChips();renderList()})});
}
function renderList(){
  var s=SENTENCES[curSent];
  $('#c-list').innerHTML = s.rows.map(function(r){
    return '<div class="c-row">'+
      '<div class="c-name" style="--c:'+r.color+'"><b>'+r.d+'</b><span class="cb"></span></div>'+
      '<div><div class="c-ph">'+r.ph+'</div><div class="c-py">'+r.py+'</div></div>'+
      '<div class="c-mean">'+r.mean+'</div>'+
      '<button type="button" class="c-play" title="试听（普通话合成音）" aria-label="试听'+r.d+'（普通话合成音）" data-t="'+r.ph+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>'+
    '</div>';
  }).join('');
  $$('#c-list .c-play').forEach(function(btn){btn.addEventListener('click',function(){speak(btn.getAttribute('data-t')||'',btn)})});
}

/* ===== 测验 ===== */
var qIdx=0,qScore=0,qDone=0,qLocked=false;
function renderQuiz(){
  $('#q-progress').innerHTML = QUIZ.map(function(_,i){return '<i class="'+(i<qDone?'done':'')+'"></i>'}).join('');
  $('#q-stage').textContent = '第 '+(qIdx+1)+' / '+QUIZ.length+' 题';
  var q=QUIZ[qIdx];
  var html='<div class="q-ph">“'+q.ph+'”</div><div class="q-q">'+q.q+'</div><div class="q-opts">';
  q.options.forEach(function(o,i){ html+='<button type="button" class="q-opt" data-i="'+i+'"><span>'+String.fromCharCode(65+i)+'.</span> '+o+'</button>'; });
  html+='</div><div class="q-feedback" id="q-feedback" role="status" aria-live="polite"></div><button type="button" class="q-next" id="q-next">下一题</button>';
  $('#q-body').innerHTML=html;
  qLocked=false;
  $$('#q-body .q-opt').forEach(function(btn){btn.addEventListener('click',function(){answer(parseInt(btn.getAttribute('data-i'),10))})});
  $('#q-next').addEventListener('click',nextQ);
}
function answer(sel){
  if(qLocked)return; qLocked=true; qDone++;
  var q=QUIZ[qIdx];
  var opts=$$('#q-body .q-opt');
  opts.forEach(function(o){o.classList.add('lock');o.setAttribute('aria-disabled','true')});
  var right = sel===q.answer;
  if(right){qScore++;opts[q.answer].classList.add('correct')}
  else{opts[q.answer].classList.add('correct');opts[sel].classList.add('wrong')}
  if(window.FANGYAN_LEARN)window.FANGYAN_LEARN.recordAnswer({quizIndex:qIdx,correct:right,choice:sel,at:Date.now()});
  var fb=$('#q-feedback');
  fb.innerHTML='<b>'+ (right?'答对啦 ✓':'答错啦，正确答案是 '+q.options[q.answer]) +'</b>'+q.why;
  fb.classList.add('show');
  $('#q-next').classList.add('show');
  $('#q-progress').children[qDone-1].classList.add('done');
  try{$('#q-next').focus({preventScroll:true})}catch(e){}
}
function nextQ(){
  qIdx++;
  if(qIdx>=QUIZ.length){showResult();return}
  renderQuiz();
  var first=$('#q-body .q-opt');
  if(first){try{first.focus({preventScroll:true})}catch(e){}}
}
function showResult(){
  $('#q-stage').textContent='测验完成';
  $('#q-progress').innerHTML=QUIZ.map(function(){return '<i class="done"></i>'}).join('');
  if(window.FANGYAN_LEARN)window.FANGYAN_LEARN.recordAttempt({score:qScore,total:QUIZ.length,at:Date.now()});
  var msg = qScore===QUIZ.length?'全对！你是方言行家':qScore>=7?'不错，耳朵很灵':'再听几遍，方言耳朵会慢慢练出来';
  $('#q-body').innerHTML='<div class="q-result show">'+
    '<div class="r-num">'+qScore+' / '+QUIZ.length+'</div>'+
    '<p>'+msg+'</p><button type="button" class="q-again">再测一次</button></div>';
  $('.q-again').addEventListener('click',function(){qIdx=0;qScore=0;qDone=0;renderQuiz()});
  try{$('.q-again').focus({preventScroll:true})}catch(e){}
}

/* ===== 冷知识 ===== */
function renderFacts(){
  $('#f-grid').innerHTML = FACTS.map(function(f){
    return '<div class="f-card rv"><div class="f-num acc" style="--c:'+f.c+';--c2:'+f.c2+'">'+f.n+'</div>'+
      '<div><h3>'+f.t+'</h3><p>'+f.d+'</p></div></div>';
  }).join('');
}

/* ===== 滚动显现 / 导航高亮 ===== */
function observeRVs(){
  var items=$$('.rv');
  if(!('IntersectionObserver' in window)){items.forEach(function(i){i.classList.add('in')});return}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});
  items.forEach(function(i){io.observe(i)});
}
(function(){
  var links=$$('.nav-links a');
  var secs=['dian','words','dui','quiz','facts','mine','community'].map(function(id){return document.getElementById(id)});
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ links.forEach(function(a){a.style.opacity = a.getAttribute('href')==='#'+e.target.id?'1':'.82'}); } });
    },{rootMargin:'-40% 0px -55% 0px'});
    secs.forEach(function(s){if(s)io.observe(s)});
  }
})();

/* ===== 结构化数据（从共享方言数据生成） ===== */
(function(){
  var ld={
    '@context':'https://schema.org',
    '@type':'ItemList',
    name:'中国十大方言',
    description:'官话、粤语、吴语、闽南语、客家话、湘语、赣语、晋语、徽语、平话的方言图鉴。',
    numberOfItems:DIALECTS.length,
    itemListElement:DIALECTS.map(function(d,i){
      return {'@type':'ListItem',position:i+1,name:d.name,url:'fangyan-detail.html?d='+encodeURIComponent(d.id)};
    })
  };
  var s=document.createElement('script');
  s.type='application/ld+json';
  s.textContent=JSON.stringify(ld);
  document.head.appendChild(s);
})();

/* ===== init ===== */
renderHero(); renderDialects(); renderPills(); renderWords(); renderChips(); renderList(); renderQuiz(); renderFacts(); observeRVs();