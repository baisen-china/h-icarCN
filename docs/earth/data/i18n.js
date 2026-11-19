// UI 中英文文案 + 时区数据
window.I18N = {
  zh: {
    brandTitle: '3D 世界地球仪',
    brandSub: '七大洲 · 四大洋 · 国界 · 首都 · 人文历史地理',
    searchPh: '搜索国家 / 首都，例如：中国、东京、Egypt',
    btnGraticule: '经纬网',
    btnReset: '复位视角',
    emptyTitle: '探索这个世界',
    emptyLede: '一个可交互的三维地球仪，涵盖 176 个国家与地区边界、174 座首都，以及 42 个主要国家的人文历史地理介绍。',
    guide1t: '旋转与缩放', guide1d: '拖动鼠标旋转地球，滚轮或双指缩放查看局部细节。',
    guide2t: '点击国家 / 首都', guide2d: '点击彩色国家或金色首都点，左侧会显示详细介绍并自动定位。',
    guide3t: '按大洲筛选', guide3d: '点击右侧图例中的大洲，可高亮该洲并淡化其他区域。',
    guide4t: '搜索定位', guide4d: '顶部搜索框支持中文名、英文名与首都名，如“法国”“Tokyo”。',
    emptyNote: '国界依据 Natural Earth 1:110m 数据绘制；大洲以颜色区分，四大洋以蓝色斜体标注。点击空白处或按 Esc 可关闭详情。',
    layers: '图层显示', layerBorders: '国家边界与着色', layerCapitals: '首都标记点',
    layerCapitalNames: '主要国家首都名', layerContinents: '七大洲名称', layerOceans: '四大洋名称',
    layerRotate: '自动旋转', layerTimezones: '时区分界线',
    continents: '七大洲', oceans: '四大洋', quick: '快速前往',
    legendCaption: '按大洲给国家着色，点击可筛选',
    legendFiltered: '已筛选：{x}（再次点击取消）',
    tzTitle: '时区选线', tzSelect: '选择时区', tzNone: '不选中', tzNow: '当地时间',
    tzHint: '开启后显示 24 条时区标线；选择具体时区会标红该时区区域并显示当地时间。',
    speechOn: '语音播报', speechOff: '停止播报', speechStop: '停止',
    tabGeo: '地理', tabHist: '历史', tabCult: '人文',
    panelGeo: '地理环境', panelHist: '历史沿革', panelCult: '人文风貌',
    noStory: '该地区暂未收录详细的人文历史地理介绍。',
    noStoryHint: '可尝试点击其他主要国家，或使用顶部搜索框。',
    hintDrag: '拖动', hintZoom: '滚轮', hintClick: '点击', hintEsc: 'Esc',
    hintRotate: '旋转', hintScale: '缩放', hintView: '查看国家', hintClose: '关闭详情',
    close: '关闭', unknown: '未知区域', capitalOf: '首都', searchMeta: '点击看详情',
    factNameZh: '中文名', factNameEn: '英文名', factContinent: '所属大洲',
    factCapital: '首都', factArea: '面积', factPop: '人口', factCurrency: '货币', factLang: '语言',
    langLabel: 'EN', loadingTitle: '正在绘制地球…', loadingSub: '加载地形纹理与国家边界数据'
  },
  en: {
    brandTitle: '3D World Globe',
    brandSub: '7 Continents · 4 Oceans · Borders · Capitals · Culture, History & Geography',
    searchPh: 'Search country / capital, e.g. China, Tokyo, Egypt',
    btnGraticule: 'Graticule',
    btnReset: 'Reset view',
    emptyTitle: 'Explore the World',
    emptyLede: 'An interactive 3D globe with 176 country & region borders, 174 capitals, and culture, history & geography notes for 42 major countries.',
    guide1t: 'Rotate & Zoom', guide1d: 'Drag to rotate the globe; scroll or pinch to zoom into details.',
    guide2t: 'Click a Country / Capital', guide2d: 'Click a colored country or a gold capital dot to see details and auto-focus.',
    guide3t: 'Filter by Continent', guide3d: 'Click a continent in the legend to highlight it and fade the rest.',
    guide4t: 'Search & Locate', guide4d: 'Search by Chinese name, English name or capital, e.g. "France" or "Tokyo".',
    emptyNote: 'Borders follow Natural Earth 1:110m. Continents are color-coded; the four oceans are labeled in blue italics. Click empty space or press Esc to close.',
    layers: 'Layers', layerBorders: 'Borders & shading', layerCapitals: 'Capital markers',
    layerCapitalNames: 'Major capital names', layerContinents: 'Continent names', layerOceans: 'Ocean names',
    layerRotate: 'Auto rotate', layerTimezones: 'Timezone lines',
    continents: 'Continents', oceans: 'Oceans', quick: 'Quick links',
    legendCaption: 'Countries colored by continent; click to filter',
    legendFiltered: 'Filtered: {x} (click again to clear)',
    tzTitle: 'Timezones', tzSelect: 'Select timezone', tzNone: 'None', tzNow: 'Local time',
    tzHint: 'Enable to show 24 timezone lines; selecting a timezone highlights its region in red and shows the local time.',
    speechOn: 'Speak', speechOff: 'Stop speech', speechStop: 'Stop',
    tabGeo: 'Geography', tabHist: 'History', tabCult: 'Culture',
    panelGeo: 'Geography', panelHist: 'History', panelCult: 'Culture & People',
    noStory: 'No detailed culture, history or geography notes are available for this region yet.',
    noStoryHint: 'Try another major country or use the search box above.',
    hintDrag: 'Drag', hintZoom: 'Scroll', hintClick: 'Click', hintEsc: 'Esc',
    hintRotate: 'Rotate', hintScale: 'Zoom', hintView: 'View country', hintClose: 'Close details',
    close: 'Close', unknown: 'Unknown region', capitalOf: 'Capital', searchMeta: 'Click for details',
    factNameZh: 'Chinese name', factNameEn: 'English name', factContinent: 'Continent',
    factCapital: 'Capital', factArea: 'Area', factPop: 'Population', factCurrency: 'Currency', factLang: 'Language',
    langLabel: '中', loadingTitle: 'Drawing the globe…', loadingSub: 'Loading terrain texture and border data'
  }
};

// 24 个整点时区（UTC-12 ~ UTC+12，另含 UTC+13/+14）
window.TIMEZONES = (function () {
  const list = [];
  for (let o = -12; o <= 14; o++) {
    const label = o === 0 ? 'UTC±0' : (o > 0 ? `UTC+${o}` : `UTC${o}`);
    list.push({ offset: o, label });
  }
  return list;
})();

// 各大洲、四大洋英文对照
window.CONTINENT_EN = {
  '亚洲': 'Asia', '非洲': 'Africa', '欧洲': 'Europe', '北美洲': 'North America',
  '南美洲': 'South America', '大洋洲': 'Oceania', '南极洲': 'Antarctica', '其他': 'Other'
};
window.OCEAN_EN = {
  '太平洋': 'Pacific Ocean', '大西洋': 'Atlantic Ocean', '印度洋': 'Indian Ocean', '北冰洋': 'Arctic Ocean'
};
