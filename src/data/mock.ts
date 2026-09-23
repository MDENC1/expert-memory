import type { CalendarDay, Notice, Organization } from "../types";

export const organization: Organization = {
  id: "org_101",
  name: "Young Israel of Example",
  shortName: "YI Example",
  timezone: "America/New_York",
  logoText: "YI",
  deviceCount: 247,
  accent: "#111827"
};

const hebrewDates = [
  ["11","Tishrei"],["12","Tishrei"],["13","Tishrei"],["14","Tishrei"],["15","Tishrei"],
  ["16","Tishrei"],["17","Tishrei"],["18","Tishrei"],["19","Tishrei"],["20","Tishrei"],
  ["21","Tishrei"],["22","Tishrei"],["23","Tishrei"],["24","Tishrei"],["25","Tishrei"],
  ["26","Tishrei"],["27","Tishrei"],["28","Tishrei"],["29","Tishrei"],["30","Tishrei"],
  ["1","Cheshvan"],["2","Cheshvan"],["3","Cheshvan"],["4","Cheshvan"],["5","Cheshvan"],
  ["6","Cheshvan"],["7","Cheshvan"],["8","Cheshvan"],["9","Cheshvan"],["10","Cheshvan"],
  ["11","Cheshvan"]
];

export const calendarDays: CalendarDay[] = Array.from({length: 30}, (_, i) => {
  const day = i + 1;
  const dow = (4 + i) % 7;
  const [hDay, hMonth] = hebrewDates[i];
  const isFriday = dow === 5;
  const isSaturday = dow === 6;
  const isSunday = dow === 0;

  return {
    date: `2026-10-${String(day).padStart(2,"0")}`,
    englishDay: day,
    hebrewDate: hDay,
    hebrewMonth: hMonth,
    shacharis: isSaturday ? "9:00" : isSunday ? "8:00" : "6:30 · 7:30",
    mincha: isFriday ? "6:15" : "6:25",
    maariv: isSaturday ? "7:35" : "8:15",
    template: isSaturday ? "Shabbos" : isFriday ? "Friday" : isSunday ? "Sunday" : "Regular Weekday",
    isShabbos: isSaturday,
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
