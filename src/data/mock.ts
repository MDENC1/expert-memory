import type { CalendarDay, JewishMonthTemplate, Notice, Organization } from "../types";

export const organization: Organization = {
  id: "org_101",
  name: "Young Israel of Example",
  shortName: "YI Example",
  timezone: "America/New_York",
  logoText: "YI",
  deviceCount: 247,
  accent: "#111827"
};

// October 2026: Tishrei–Cheshvan 5787.
// In production these dates/events should be generated from a Jewish-calendar service/library,
// not typed by an administrator.
const hebrewDates = [
  ["20","Tishrei"],["21","Tishrei"],["22","Tishrei"],["23","Tishrei"],["24","Tishrei"],
  ["25","Tishrei"],["26","Tishrei"],["27","Tishrei"],["28","Tishrei"],["29","Tishrei"],
  ["30","Tishrei"],["1","Cheshvan"],["2","Cheshvan"],["3","Cheshvan"],["4","Cheshvan"],
  ["5","Cheshvan"],["6","Cheshvan"],["7","Cheshvan"],["8","Cheshvan"],["9","Cheshvan"],
  ["10","Cheshvan"],["11","Cheshvan"],["12","Cheshvan"],["13","Cheshvan"],["14","Cheshvan"],
  ["15","Cheshvan"],["16","Cheshvan"],["17","Cheshvan"],["18","Cheshvan"],["19","Cheshvan"],
  ["20","Cheshvan"]
];

const holidays: Record<number,string> = {
  1: "Sukkos VI (Chol Hamoed)",
  2: "Hoshana Rabbah",
  3: "Shemini Atzeres",
  4: "Simchas Torah"
};

const keyTimes: Record<number, CalendarDay["specialTimes"]> = {
  2: [{key:"candle_lighting", label:"Candle Lighting", time:"6:18 PM", importance:"prominent"}],
  3: [{key:"yom_tov_candles", label:"Yom Tov Candle Lighting", time:"7:47 PM", importance:"prominent"}],
  4: [{key:"yom_tov_ends", label:"Yom Tov Ends", time:"7:47 PM", importance:"prominent"}],
  9: [{key:"candle_lighting", label:"Candle Lighting", time:"6:06 PM", importance:"prominent"}],
  10: [{key:"shabbos_ends", label:"Shabbos Ends", time:"7:35 PM", importance:"prominent"}],
  16: [{key:"candle_lighting", label:"Candle Lighting", time:"5:56 PM", importance:"prominent"}],
  17: [{key:"shabbos_ends", label:"Shabbos Ends", time:"7:25 PM", importance:"prominent"}],
  23: [{key:"candle_lighting", label:"Candle Lighting", time:"5:45 PM", importance:"prominent"}],
  24: [{key:"shabbos_ends", label:"Shabbos Ends", time:"7:15 PM", importance:"prominent"}],
  30: [{key:"candle_lighting", label:"Candle Lighting", time:"5:36 PM", importance:"prominent"}],
  31: [{key:"shabbos_ends", label:"Shabbos Ends", time:"7:05 PM", importance:"prominent"}]
};

export const calendarDays: CalendarDay[] = Array.from({length: 31}, (_, i) => {
  const day = i + 1;
  const dow = (4 + i) % 7;
  const [hDay, hMonth] = hebrewDates[i];
  const isFriday = dow === 5;
  const isSaturday = dow === 6;
  const isSunday = dow === 0;
  const isRoshChodesh = day === 11 || day === 12;
  const holiday = holidays[day];

  return {
    date: `2026-10-${String(day).padStart(2,"0")}`,
    englishDay: day,
    hebrewDate: hDay,
    hebrewMonth: hMonth,
    shacharis: isRoshChodesh ? "6:15 · 7:15" : isSaturday ? "9:00" : isSunday ? "8:00" : "6:30 · 7:30",
    mincha: isFriday ? "6:15" : "6:25",
    maariv: isSaturday ? "7:35" : "8:15",
    template: isRoshChodesh ? "Rosh Chodesh" : isSaturday ? "Shabbos" : isFriday ? "Friday" : isSunday ? "Sunday" : "Regular Weekday",
    isShabbos: isSaturday,
    isRoshChodesh,
    holiday,
    specialTimes: keyTimes[day],
    event: day === 5 ? "Board Meeting" : day === 17 ? "Scholar-in-Residence" : undefined
  };
});

export const notices: Notice[] = [
  {
    id: "notice_1",
    type: "Sponsorship",
    headline: "Shabbos Kiddush Sponsored",
    details: "Sponsored by the Cohen family in honor of their anniversary.",
    startAt: "2026-10-16",
    endAt: "2026-10-17",
    priority: "normal",
    publishMode: "scheduled",
    status: "scheduled"
  },
  {
    id: "notice_2",
    type: "Yahrtzeit",
    headline: "Yahrtzeit Reminder",
    details: "Please remember the yahrtzeit listed for this week.",
    startAt: "2026-10-08",
    endAt: "2026-10-09",
    priority: "normal",
    publishMode: "scheduled",
    status: "live"
  }
];

export const templates = [
  {name:"Regular Weekday", shacharis:"6:30 · 7:30", mincha:"6:25", maariv:"8:15"},
  {name:"Sunday", shacharis:"8:00", mincha:"6:25", maariv:"8:15"},
  {name:"Friday", shacharis:"6:30 · 7:30", mincha:"6:15", maariv:"—"},
  {name:"Shabbos", shacharis:"9:00", mincha:"6:10", maariv:"7:35"},
  {name:"Rosh Chodesh", shacharis:"6:15 · 7:15", mincha:"6:25", maariv:"8:15"},
  {name:"Fast Day", shacharis:"6:15 · 7:15", mincha:"6:00", maariv:"8:10"}
];

// Product template library. These are suggested fields, not assumptions about every shul.
// The org can enable/disable fields based on minhag, nusach and local practice.
export const jewishMonthTemplates: JewishMonthTemplate[] = [
  {month:"Tishrei", specialItems:[
    {key:"selichos",label:"Selichos",appliesTo:"Selichos days",defaultDisplay:true},
    {key:"rh_shacharis",label:"Rosh Hashana Shacharis",appliesTo:"Rosh Hashana",defaultDisplay:true},
    {key:"shofar",label:"Shofar",appliesTo:"Rosh Hashana",defaultDisplay:true,helpText:"Supports multiple shofar times."},
    {key:"yk_kol_nidrei",label:"Kol Nidrei",appliesTo:"Erev Yom Kippur",defaultDisplay:true},
    {key:"yk_shacharis",label:"Yom Kippur Shacharis",appliesTo:"Yom Kippur",defaultDisplay:true},
    {key:"yk_yizkor",label:"Yizkor",appliesTo:"Yom Kippur",defaultDisplay:true},
    {key:"yk_neilah",label:"Neilah",appliesTo:"Yom Kippur",defaultDisplay:true},
    {key:"sukkos_shacharis",label:"Sukkos Shacharis",appliesTo:"Sukkos / Chol Hamoed",defaultDisplay:true},
    {key:"hoshana_rabbah",label:"Hoshana Rabbah Shacharis",appliesTo:"Hoshana Rabbah",defaultDisplay:true},
    {key:"shemini_yizkor",label:"Shemini Atzeres Yizkor",appliesTo:"Shemini Atzeres",defaultDisplay:true},
    {key:"hakafos_night",label:"Hakafos - Night",appliesTo:"Simchas Torah",defaultDisplay:true},
    {key:"hakafos_day",label:"Hakafos - Day",appliesTo:"Simchas Torah",defaultDisplay:true}
  ]},
  {month:"Cheshvan",specialItems:[]},
  {month:"Kislev",specialItems:[
    {key:"chanukah_lighting",label:"Community Chanukah Lighting",appliesTo:"Chanukah",defaultDisplay:false}
  ]},
  {month:"Teves",specialItems:[
    {key:"asarah_fast_begins",label:"Asarah B'Teves Fast Begins",appliesTo:"10 Teves",defaultDisplay:true},
    {key:"asarah_mincha",label:"Fast-Day Mincha",appliesTo:"10 Teves",defaultDisplay:true},
    {key:"asarah_fast_ends",label:"Fast Ends",appliesTo:"10 Teves",defaultDisplay:true}
  ]},
  {month:"Shevat",specialItems:[
    {key:"tu_bishvat_event",label:"Tu B'Shvat Program",appliesTo:"15 Shevat",defaultDisplay:false}
  ]},
  {month:"Adar",specialItems:[
    {key:"taanis_esther",label:"Taanis Esther Schedule",appliesTo:"Taanis Esther",defaultDisplay:true},
    {key:"megillah_night",label:"Megillah - Night",appliesTo:"Purim",defaultDisplay:true},
    {key:"megillah_day",label:"Megillah - Day",appliesTo:"Purim",defaultDisplay:true},
    {key:"purim_program",label:"Purim Program / Seudah",appliesTo:"Purim",defaultDisplay:false}
  ]},
  {month:"Nissan",specialItems:[
    {key:"shabbos_hagadol",label:"Shabbos Hagadol Drasha",appliesTo:"Shabbos Hagadol",defaultDisplay:false},
    {key:"siyum_bechorim",label:"Siyum Bechorim",appliesTo:"Erev Pesach",defaultDisplay:true},
    {key:"chametz_deadlines",label:"Chametz Deadlines",appliesTo:"Erev Pesach",defaultDisplay:true},
    {key:"pesach_shacharis",label:"Pesach Shacharis",appliesTo:"Pesach",defaultDisplay:true},
    {key:"pesach_yizkor",label:"Pesach Yizkor",appliesTo:"Last day of Pesach",defaultDisplay:true}
  ]},
  {month:"Iyar",specialItems:[
    {key:"lag_baomer",label:"Lag B'Omer Program",appliesTo:"18 Iyar",defaultDisplay:false}
  ]},
  {month:"Sivan",specialItems:[
    {key:"shavuos_learning",label:"Shavuos Night Learning",appliesTo:"Shavuos",defaultDisplay:true},
    {key:"shavuos_shacharis",label:"Shavuos Shacharis",appliesTo:"Shavuos",defaultDisplay:true},
    {key:"shavuos_yizkor",label:"Shavuos Yizkor",appliesTo:"Shavuos",defaultDisplay:true}
  ]},
  {month:"Tammuz",specialItems:[
    {key:"17_tammuz_begins",label:"17 Tammuz Fast Begins",appliesTo:"17 Tammuz",defaultDisplay:true},
    {key:"17_tammuz_mincha",label:"Fast-Day Mincha",appliesTo:"17 Tammuz",defaultDisplay:true},
    {key:"17_tammuz_ends",label:"Fast Ends",appliesTo:"17 Tammuz",defaultDisplay:true}
  ]},
  {month:"Av",specialItems:[
    {key:"tisha_bav_maariv",label:"Tisha B'Av Maariv / Eicha",appliesTo:"Tisha B'Av",defaultDisplay:true},
    {key:"tisha_bav_shacharis",label:"Tisha B'Av Shacharis",appliesTo:"Tisha B'Av",defaultDisplay:true},
    {key:"tisha_bav_mincha",label:"Tisha B'Av Mincha",appliesTo:"Tisha B'Av",defaultDisplay:true},
    {key:"tisha_bav_ends",label:"Fast Ends",appliesTo:"Tisha B'Av",defaultDisplay:true}
  ]},
  {month:"Elul",specialItems:[
    {key:"selichos",label:"Selichos",appliesTo:"Configured Selichos days",defaultDisplay:true,helpText:"Date pattern depends on minhag; organization settings determine when it begins."}
  ]}
];
