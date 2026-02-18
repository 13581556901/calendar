
export interface LunarInfo {
  lunarDay: string;
  lunarMonth: string;
  festival?: string;
}

export const getLunarInfo = (date: Date): LunarInfo => {
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      day: 'numeric',
      month: 'long',
    });
    const parts = formatter.formatToParts(date);
    const monthStr = parts.find(p => p.type === 'month')?.value || '';
    const dayStr = parts.find(p => p.type === 'day')?.value || '';
    
    const dayMap: Record<string, string> = {
      '1': '初一', '2': '初二', '3': '初三', '4': '初四', '5': '初五',
      '6': '初六', '7': '初七', '8': '初八', '9': '初九', '10': '初十',
      '20': '二十', '30': '三十'
    };
    
    let displayDay = dayMap[dayStr];
    if (!displayDay) {
      const d = parseInt(dayStr);
      if (d < 20) displayDay = '十' + (dayMap[d % 10] || '十').replace('初', '');
      else if (d < 30) displayDay = '廿' + (dayMap[d % 10] || '十').replace('初', '');
      else displayDay = dayStr;
    }

    // Comprehensive Festival Mapping
    const festivals: Record<string, string> = {
      '正月初一': '春节',
      '正月十五': '元宵节',
      '二月初二': '龙抬头',
      '五月初五': '端午节',
      '七月初七': '七夕',
      '八月十五': '中秋节',
      '九月初九': '重阳',
      '腊月初八': '腊八',
      '腊月廿三': '小年',
      '腊月三十': '除夕',
    };

    // 24 Solar Terms (Approximate Calculation for UI enhancement)
    const solarTerms: Record<string, string> = {
      '2-4': '立春', '2-19': '雨水', '3-5': '惊蛰', '3-20': '春分',
      '4-4': '清明', '4-20': '谷雨', '5-5': '立夏', '5-21': '小满',
      '6-5': '芒种', '6-21': '夏至', '7-7': '小暑', '7-22': '大暑',
      '8-7': '立秋', '8-23': '处暑', '9-7': '白露', '9-22': '秋分',
      '10-8': '寒露', '10-23': '霜降', '11-7': '立冬', '11-22': '小雪',
      '12-7': '大雪', '12-21': '冬至', '1-5': '小寒', '1-20': '大寒'
    };
    const solarKey = `${date.getMonth() + 1}-${date.getDate()}`;

    const key = `${monthStr}${displayDay}`;
    
    return {
      lunarMonth: monthStr,
      lunarDay: displayDay,
      festival: festivals[key] || solarTerms[solarKey]
    };
  } catch (e) {
    return { lunarMonth: '', lunarDay: '' };
  }
};

export const getSolarFestival = (date: Date): string | undefined => {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const solarFestivals: Record<string, string> = {
    '1-1': '元旦',
    '2-14': '情人节',
    '3-8': '妇女节',
    '3-12': '植树节',
    '4-1': '愚人节',
    '5-1': '劳动节',
    '5-4': '青年节',
    '6-1': '儿童节',
    '8-1': '建军节',
    '9-10': '教师节',
    '10-1': '国庆节',
    '10-24': '程序员节',
    '11-11': '双十一',
    '12-24': '平安夜',
    '12-25': '圣诞节',
  };
  return solarFestivals[`${m}-${d}`];
};

export const getLunarDate = (date: Date): string => {
  const info = getLunarInfo(date);
  const solar = getSolarFestival(date);
  return solar || info.festival || `${info.lunarMonth}${info.lunarDay}`;
};
