import type { CalendarDay, Notice } from "../types";

export const MAGNET_WIDTH = 648;
export const MAGNET_HEIGHT = 480;

const DAF_TRACTATE_HEBREW:Record<string,string>={
  "Berakhot":"ברכות","Shabbat":"שבת","Eruvin":"עירובין","Pesachim":"פסחים","Shekalim":"שקלים",
  "Yoma":"יומא","Sukkah":"סוכה","Beitzah":"ביצה","Rosh Hashana":"ראש השנה","Taanit":"תענית",
  "Megillah":"מגילה","Moed Katan":"מועד קטן","Chagigah":"חגיגה","Yevamot":"יבמות","Ketubot":"כתובות",
  "Nedarim":"נדרים","Nazir":"נזיר","Sotah":"סוטה","Gittin":"גיטין","Kiddushin":"קידושין",
  "Bava Kamma":"בבא קמא","Bava Metzia":"בבא מציעא","Bava Batra":"בבא בתרא","Sanhedrin":"סנהדרין",
  "Makkot":"מכות","Shevuot":"שבועות","Avodah Zarah":"עבודה זרה","Horayot":"הוריות","Zevachim":"זבחים",
  "Menachot":"מנחות","Chullin":"חולין","Bechorot":"בכורות","Arakhin":"ערכין","Temurah":"תמורה",
  "Keritot":"כריתות","Meilah":"מעילה","Kinnim":"קינים","Tamid":"תמיד","Middot":"מידות","Niddah":"נדה"
};

function hebrewNumber(value:number){
  if(!Number.isFinite(value)||value<=0)return String(value);
  const ones=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  const tens=["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
  const hundreds=["","ק","ר","ש","ת"];
  let n=value;
  let out="";
  while(n>=400){out+="ת";n-=400;}
  if(n>=100){const h=Math.floor(n/100);out+=hundreds[h]||"";n%=100;}
  if(n===15){out+="טו";n=0;}
  else if(n===16){out+="טז";n=0;}
  else{
    if(n>=10){out+=tens[Math.floor(n/10)]||"";n%=10;}
    if(n>0)out+=ones[n]||"";
  }
  if(out.length===1)return out+"׳";
  return out.slice(0,-1)+"״"+out.slice(-1);
}

function dafYomiHebrew(value:string){
  const match=value.trim().match(/^(.*)\s+(\d+)$/);
  if(!match)return "";
  const tractate=DAF_TRACTATE_HEBREW[match[1]];
  if(!tractate)return "";
  return `${tractate} ${hebrewNumber(Number(match[2]))}`;
}


type RenderOptions = {
  day: CalendarDay;
  notice?: Notice;
  shulName: string;
  width?: number;
  height?: number;
};

function clippedText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "…";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  if (maxLines <= 0) return [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let consumed = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      consumed += 1;
      continue;
    }

    if (!line) {
      line = clippedText(ctx, word, maxWidth);
      consumed += 1;
    }

    lines.push(line);
    if (lines.length >= maxLines) {
      line = "";
      break;
    }

    line = word;
    consumed += 1;
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (consumed < words.length && lines.length) {
    const last = lines.length - 1;
    let value = lines[last].replace(/…$/,"");
    while (value.length > 1 && ctx.measureText(value + "…").width > maxWidth) {
      value = value.slice(0,-1);
    }
    lines[last] = value + "…";
  }

  return lines;
}

function drawDivider(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width = 2) {
  ctx.fillRect(x1, y1, x2 - x1 || width, y2 - y1 || width);
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  label: string,
  time: string | undefined,
  x: number,
  y: number,
  width: number,
  labelWidth = 150,
  fontSize = 18
) {
  ctx.textAlign = "left";
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  ctx.fillText(
    clippedText(ctx, label, Math.max(40,Math.min(labelWidth, width - Math.max(62,fontSize*4.2)))),
    x,
    y
  );

  ctx.textAlign = "right";
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  ctx.fillText(clippedText(ctx, time || "", Math.max(62,fontSize*5.8)), x + width, y);
  ctx.textAlign = "left";
}

function drawCanonicalScreen(ctx: CanvasRenderingContext2D, day: CalendarDay, notice: Notice | undefined, shulName: string) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, MAGNET_WIDTH, MAGNET_HEIGHT);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.textBaseline = "top";

  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, MAGNET_WIDTH - 6, MAGNET_HEIGHT - 6);

  const parsed = new Date(`${day.date}T12:00:00`);
  const englishDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
  const hebrewDate = day.hebrewFullDate || `${day.hebrewDate} ${day.hebrewMonth}`;

  // Header
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 72, 58);
  ctx.font = "700 16px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LOGO", 54, 38);

  ctx.textAlign = "left";
  ctx.font = "900 28px Arial, sans-serif";
  ctx.fillText(clippedText(ctx, shulName.toUpperCase(), 400), 108, 17);

  ctx.font = "700 14px Arial, sans-serif";
  ctx.fillText(clippedText(ctx, englishDate, 280), 108, 55);

  ctx.save();
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.font = "900 17px Arial, sans-serif";
  ctx.fillText(clippedText(ctx, hebrewDate, 210), 628, 53);
  ctx.restore();

  ctx.fillRect(18, 88, 612, 3);

  const prominent = day.specialTimes?.filter((item) => item.importance === "prominent") ?? [];
  let contentTop = 106;

  if (prominent.length) {
    const items = prominent.slice(0, 3);
    const boxHeight = 62;
    ctx.lineWidth = 3;
    ctx.strokeRect(18, contentTop, 612, boxHeight);
    const cellWidth = 612 / items.length;

    items.forEach((item, index) => {
      const x = 18 + index * cellWidth;
      if (index > 0) ctx.fillRect(x, contentTop, 2, boxHeight);
      ctx.textAlign = "center";
      ctx.font = "800 13px Arial, sans-serif";
      ctx.fillText(clippedText(ctx, item.label.toUpperCase(), cellWidth - 16), x + cellWidth / 2, contentTop + 8);
      ctx.font = "900 24px Arial, sans-serif";
      ctx.fillText(clippedText(ctx, item.time || "", cellWidth - 16), x + cellWidth / 2, contentTop + 29);
    });

    ctx.textAlign = "left";
    contentTop += boxHeight + 14;
  }

  const footerTop = 452;

  // Main content is intentionally 40:60 — Zmanim gets 40% and the
  // shul schedule gets 60%.
  const contentLeft = 18;
  const contentRight = 630;
  const contentWidth = contentRight - contentLeft;
  const zmanimWidth = Math.round(contentWidth * 0.4);
  const dividerX = contentLeft + zmanimWidth;
  const columnGap = 14;
  const leftX = contentLeft;
  const rightX = dividerX + columnGap;
  const leftWidth = dividerX - leftX - columnGap;
  const rightWidth = contentRight - rightX;

  const zmanimRows = (day.zmanimRows || []).slice(0,7);
  const scheduleRows = day.shulScheduleRows?.length
    ? day.shulScheduleRows.slice(0,6)
    : [
        { label: "Shacharis", time: day.shacharis },
        { label: "Mincha", time: day.mincha },
        { label: "Maariv", time: day.maariv },
      ];

  const hasActualNotice=Boolean(notice?.headline||notice?.details||notice?.location||day.event);
  const preferredNoticeHeight = notice?.details
    ? (notice?.location ? 112 : 96)
    : notice?.location
      ? 82
      : hasActualNotice
        ? 68
        : 48;

  const rowsTop = contentTop + 43;
  const rightNoteCount=scheduleRows.filter(row=>Boolean(row.note)).length;
  const leftUnits=Math.max(1,zmanimRows.length);
  const rightUnits=Math.max(1,scheduleRows.length + rightNoteCount*0.48);
  const targetMainBottom=footerTop-preferredNoticeHeight-8;
  const availableRowsHeight=Math.max(60,targetMainBottom-rowsTop);
  const rowStep=Math.max(17,Math.min(31,Math.floor(
    availableRowsHeight/Math.max(leftUnits,rightUnits)
  )));
  const rowFontSize=Math.max(12,Math.min(18,rowStep-7));
  const noteFontSize=Math.max(9,Math.min(12,rowFontSize-3));
  const noteLineHeight=noteFontSize+3;

  // Calculate where each column will finish before drawing the divider.
  const leftBottom=zmanimRows.length
    ? rowsTop+(zmanimRows.length-1)*rowStep+rowFontSize+3
    : rowsTop+18;

  let measuredRightY=rowsTop;
  let rightBottom=rowsTop+18;
  for(const row of scheduleRows){
    rightBottom=measuredRightY+rowFontSize+3;
    if(row.note)rightBottom+=noteLineHeight;
    measuredRightY+=rowStep+(row.note?noteLineHeight:0);
  }

  const noticeTop=Math.min(
    Math.max(leftBottom,rightBottom)+8,
    footerTop-42
  );
  const splitBottom=Math.max(contentTop+32,noticeTop-8);

  ctx.font = "900 19px Arial, sans-serif";
  ctx.fillText("ZMANIM", leftX, contentTop);
  ctx.fillText(
    day.holiday ? clippedText(ctx, day.holiday.toUpperCase(), rightWidth) : "SHUL",
    rightX,
    contentTop
  );

  ctx.fillRect(dividerX, contentTop, 2, splitBottom-contentTop);
  ctx.fillRect(contentLeft, contentTop + 30, contentWidth, 2);

  let leftY = rowsTop;
  for (const row of zmanimRows) {
    drawRow(ctx, row.label, row.time, leftX, leftY, leftWidth, 120, rowFontSize);
    leftY += rowStep;
  }

  if (!zmanimRows.length) {
    ctx.font = `700 ${Math.max(12,rowFontSize-1)}px Arial, sans-serif`;
    ctx.fillText("Zmanim unavailable", leftX, leftY);
  }

  let rightY = rowsTop;
  for (const row of scheduleRows) {
    drawRow(ctx, row.label, row.time, rightX, rightY, rightWidth, 205, rowFontSize);
    if (row.note) {
      ctx.font = `${noteFontSize}px Arial, sans-serif`;
      ctx.fillText(
        clippedText(ctx, row.note, rightWidth - 8),
        rightX,
        rightY + rowFontSize + 2
      );
      rightY += noteLineHeight;
    }
    rightY += rowStep;
  }

  // Notices flow directly beneath whichever main column is longer.
  ctx.fillRect(contentLeft, noticeTop, contentWidth, 2);
  const noticeAvailableHeight=Math.max(28,footerTop-noticeTop-2);
  const compactNotice=noticeAvailableHeight<72;
  const noticeHeaderSize=compactNotice?12:15;
  const headlineSize=compactNotice?15:19;
  const bodySize=compactNotice?10:13;
  const headlineLineHeight=headlineSize+3;
  const bodyLineHeight=bodySize+3;

  ctx.font = `900 ${noticeHeaderSize}px Arial, sans-serif`;
  ctx.fillText("NOTICES", contentLeft, noticeTop + 7);

  const headline = notice?.headline || day.event || "No notices today.";
  const headlineTop=noticeTop+noticeHeaderSize+12;
  const headlineWidth=notice?.eventTime ? contentWidth-138 : contentWidth;
  ctx.font = `900 ${headlineSize}px Arial, sans-serif`;
  const maxHeadlineLines=Math.max(
    1,
    Math.min(2,Math.floor((footerTop-headlineTop-6)/headlineLineHeight))
  );
  const headlineLines=wrapText(ctx,headline,headlineWidth,maxHeadlineLines);
  headlineLines.forEach((line,index)=>{
    ctx.fillText(line,contentLeft,headlineTop+index*headlineLineHeight);
  });

  if (notice?.eventTime) {
    ctx.textAlign = "right";
    ctx.font = `900 ${headlineSize}px Arial, sans-serif`;
    ctx.fillText(clippedText(ctx, notice.eventTime, 120), contentRight, headlineTop);
    ctx.textAlign = "left";
  }

  let noticeBodyY=headlineTop+headlineLines.length*headlineLineHeight+2;

  if (notice?.location && noticeBodyY+bodyLineHeight<=footerTop-3) {
    ctx.font = `700 ${bodySize}px Arial, sans-serif`;
    ctx.fillText(
      clippedText(ctx, `Location: ${notice.location}`, contentWidth),
      contentLeft,
      noticeBodyY
    );
    noticeBodyY += bodyLineHeight;
  }

  if (notice?.details && noticeBodyY<footerTop-3) {
    ctx.font = `${bodySize}px Arial, sans-serif`;
    const detailsLines=Math.max(
      0,
      Math.floor((footerTop-noticeBodyY-3)/bodyLineHeight)
    );
    const lines = wrapText(ctx, notice.details, contentWidth, detailsLines);
    lines.forEach((line,index)=>{
      ctx.fillText(line,contentLeft,noticeBodyY+index*bodyLineHeight);
    });
  }

  ctx.fillRect(18, footerTop, 612, 2);
  ctx.font = "700 12px Arial, sans-serif";
  ctx.fillText(day.isRoshChodesh ? "Rosh Chodesh" : "Schedule", 18, footerTop + 9);
  ctx.textAlign = "right";
  if(day.dafYomi){
    const englishDaf=`Daf Yomi: ${day.dafYomi}`;
    const hebrewDaf=dafYomiHebrew(day.dafYomi);
    ctx.font = "700 12px Arial, sans-serif";
    ctx.textAlign = "right";
    if(hebrewDaf){
      ctx.save();
      ctx.direction = "rtl";
      ctx.fillText(hebrewDaf, 630, footerTop + 9);
      ctx.restore();
      const hebrewWidth=ctx.measureText(hebrewDaf).width;
      ctx.textAlign = "right";
      ctx.fillText(englishDaf, 630-hebrewWidth-18, footerTop + 9);
    }else{
      ctx.fillText(englishDaf, 630, footerTop + 9);
    }
  }
  ctx.textAlign = "left";
}

export function renderMagnetCanvas(canvas: HTMLCanvasElement, options: RenderOptions) {
  const width = Math.max(1, Math.round(options.width ?? MAGNET_WIDTH));
  const height = Math.max(1, Math.round(options.height ?? MAGNET_HEIGHT));

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create magnet canvas.");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(width / MAGNET_WIDTH, height / MAGNET_HEIGHT);
  const drawWidth = MAGNET_WIDTH * scale;
  const drawHeight = MAGNET_HEIGHT * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  drawCanonicalScreen(ctx, options.day, options.notice, options.shulName);
  ctx.restore();

  return canvas;
}

export function magnetPngBase64(options: RenderOptions) {
  const canvas = document.createElement("canvas");
  renderMagnetCanvas(canvas, options);
  return canvas.toDataURL("image/png").split(",", 2)[1];
}
