/* 一声一味 · 授权方言录音清单
 *
 * 只收录许可清晰、可再分发的录音。没有找到授权录音的方言保持为空数组，
 * 页面会显示“暂无授权录音”，不会用合成音或未授权音频冒充方言。
 *
 * 许可：
 *   - Tatoeba 录音：CC BY 4.0（逐条标注）
 *   - Taigi Speech 真人录音：CC BY-SA 4.0
 *   - WenetSpeech-Wu 示例：Apache-2.0
 */
window.FANGYAN_AUDIO = {
  guangzhou: [
    {
      title: '你好嗎？',
      translation: '你好吗？',
      roman: 'nei5 hou2 maa3',
      src: 'assets/audio/yue-nihao.mp3',
      speaker: 'cantonesespoken',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      source: 'Tatoeba',
      sourceUrl: 'https://tatoeba.org/en/sentences/show/924636',
      note: '粤语（广州话）真人录音。'
    },
    {
      title: '做得好！',
      translation: '做得好！',
      roman: 'zou6 dak1 hou2',
      src: 'assets/audio/yue-zuodehao.mp3',
      speaker: 'cantonesespoken',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      source: 'Tatoeba',
      sourceUrl: 'https://tatoeba.org/en/sentences/show/7988292',
      note: '粤语（广州话）真人录音。'
    },
    {
      title: '點解？',
      translation: '为什么？',
      roman: 'dim2 gaai2',
      src: 'assets/audio/yue-dianjie.mp3',
      speaker: 'cantonesespoken',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      source: 'Tatoeba',
      sourceUrl: 'https://tatoeba.org/en/sentences/show/1555120',
      note: '粤语（广州话）真人录音。'
    }
  ],
  xiamen: [
    {
      title: '今仔日較袂寒。',
      translation: '今天比较不冷。',
      roman: 'Kin-á-ji̍t khah bē kuânn.',
      src: 'assets/audio/minnan-jintian.mp3',
      speaker: 'SuíSiann 语料真人录音',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source: 'Taigi Speech（Guo Yu-Kai）',
      sourceUrl: 'https://github.com/GuoYuKai-SaMuEl/taigi-speech/tree/main/rocling2026/audio_human',
      note: '台湾闽南语（台语）真人录音，声调与用词和厦门、泉州口音有差异。'
    },
    {
      title: '客廳大門向啥物方向？',
      translation: '客厅大门朝什么方向？',
      roman: 'Kheh-thiann tuā-mn̂g hiòng siánn-mih hong-hiòng?',
      src: 'assets/audio/minnan-keting.mp3',
      speaker: 'SuíSiann 语料真人录音',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source: 'Taigi Speech（Guo Yu-Kai）',
      sourceUrl: 'https://github.com/GuoYuKai-SaMuEl/taigi-speech/tree/main/rocling2026/audio_human',
      note: '台湾闽南语（台语）真人录音，声调与用词和厦门、泉州口音有差异。'
    }
  ],
  shanghai: [
    {
      title: '吴语语音样本',
      translation: '该片段未提供逐字转写。',
      roman: '',
      src: 'assets/audio/wu-sample.wav',
      speaker: 'WenetSpeech-Wu 数据集示例',
      license: 'Apache-2.0',
      licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
      source: 'ASLP-lab / WenetSpeech-Wu',
      sourceUrl: 'https://github.com/ASLP-lab/WenetSpeech-Wu-Repo',
      note: '数据集示例片段，仅用于展示吴语听感；没有逐字转写，不能当作标准读音。'
    }
  ],
  beijing: [],
  meizhou: [],
  changsha: [],
  nanchang: [],
  taiyuan: [],
  huizhou: [],
  nanning: []
};
