export type Role = "super_admin" | "organization_admin" | "editor";

export type Organization = {
  id: string;
  name: string;
  shortName: string;
  timezone: string;
  logoText: string;
  deviceCount: number;
  accent: string;
};

export type CalendarDay = {
  date: string;
  englishDay: number;
  hebrewDate: string;
  hebrewMonth: string;
  shacharis?: string;
  mincha?: string;
  maariv?: string;
  event?: string;
  template?: string;
  isShabbos?: boolean;
};

export type NoticeType =
  | "Yahrtzeit"
  | "Sponsorship"
  | "Mazel Tov"
  | "Condolence / Shiva"
  | "Schedule Change"
  | "Event"
  | "General Notice";

export type Notice = {
  id: string;
  type: NoticeType;
  headline: string;
  details: string;
  startAt: string;
  endAt: string;
  priority: "normal" | "important" | "urgent";
  publishMode: "scheduled" | "immediate";
  status: "draft" | "scheduled" | "live" | "expired";
};
