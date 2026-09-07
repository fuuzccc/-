// 农历 / 节气 / 节假日信息（依赖 lunar.js 暴露的 Solar、Lunar、HolidayUtil 全局对象）
window.CalExtra = (() => {
  // 每个格子的简短标签（优先级：法定休息日 > 节气 > 农历/公历节日 > 农历日）
  function cellLabel(y, m, d) {
    let s, lunar;
    try {
      s = Solar.fromYmd(y, m, d);
      lunar = s.getLunar();
    } catch (e) {
      return null;
    }
    const lunarDay = lunar.getDayInChinese(); // 初一..三十
    const lunarMonth = lunar.getMonthInChinese();
    const lunarLabel = lunarDay === '初一' ? `${lunarMonth}月${lunarDay}` : lunarDay;
    let jieQi = '';
    try { jieQi = lunar.getJieQi(); } catch (e) {}
    let holiday = null;
    try { holiday = HolidayUtil.getHoliday(y, m, d); } catch (e) {}
    let lunarFests = [];
    let solarFests = [];
    try { lunarFests = lunar.getFestivals(); } catch (e) {}
    try { solarFests = s.getFestivals(); } catch (e) {}
    const allFests = Array.from(new Set([...lunarFests, ...solarFests]));

    // 法定休息日（放假）
    if (holiday && !holiday.isWork()) {
      return { text: holiday.getName(), cls: 'holiday', rest: true };
    }
    if (jieQi) {
      return { text: jieQi, cls: 'solar', rest: false };
    }
    if (allFests.length) {
      return { text: allFests[0], cls: 'fest', rest: false };
    }
    return { text: lunarLabel, cls: '', rest: false };
  }

  // 是否调休上班日
  function isWorkDay(y, m, d) {
    try {
      const h = HolidayUtil.getHoliday(y, m, d);
      return !!(h && h.isWork());
    } catch (e) { return false; }
  }

  // 右侧详情面板的农历与节日信息
  function dayDetail(y, m, d) {
    try {
      const s = Solar.fromYmd(y, m, d);
      const lunar = s.getLunar();
      const lunarMonth = lunar.getMonthInChinese();
      const lunarDay = lunar.getDayInChinese();
      // 若为闰月，getMonthInChinese 可能返回负数，转为“闰X”
      const monthText = lunarMonth < 0 ? `闰${lunar.getMonthInChinese().replace('-', '')}` : lunarMonth;
      const lunarDate = `${lunar.getYearInChinese()}年 ${monthText}月${lunarDay}`;
      const jieQi = lunar.getJieQi() || '';
      const fests = Array.from(new Set([...lunar.getFestivals(), ...s.getFestivals(), ...lunar.getOtherFestivals()]));
      let holiday = null;
      try { holiday = HolidayUtil.getHoliday(y, m, d); } catch (e) {}
      return { lunarDate, jieQi, fests, holiday };
    } catch (e) {
      return null;
    }
  }

  return { cellLabel, isWorkDay, dayDetail };
})();
