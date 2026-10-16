export type LinkedSpecialEvent = {
  key:string;
  label:string;
};

type LinkedSpecialEventContext = {
  isCholHamoed?:boolean;
  title?:string;
};

const SIMCHAS_BEIS_HASHOEVA:LinkedSpecialEvent={
  key:"simchas_beis_hashoeva",
  label:"Simchas Beis Hashoeva"
};

const MENORAH_LIGHTING:LinkedSpecialEvent={
  key:"menorah_lighting",
  label:"Menorah Lighting"
};

const CHANUKAH_PARTY:LinkedSpecialEvent={
  key:"chanukah_party",
  label:"Chanukah Party"
};

const TU_BISHVAT_PARTY:LinkedSpecialEvent={
  key:"tu_bishvat_party",
  label:"Tu B'Shvat Party"
};

const PURIM_PARTY:LinkedSpecialEvent={
  key:"purim_party",
  label:"Purim Party"
};

const SHABBOS_HAGADOL_DRASHA:LinkedSpecialEvent={
  key:"shabbos_hagadol_drasha",
  label:"Shabbos HaGadol Drasha"
};

const SIYUM_BECHORIM:LinkedSpecialEvent={
  key:"siyum_bechorim",
  label:"Siyum Bechorim"
};

const BIUR_CHAMETZ:LinkedSpecialEvent={
  key:"biur_chametz",
  label:"Biur Chametz"
};

const MECHIRAS_CHAMETZ:LinkedSpecialEvent={
  key:"mechiras_chametz",
  label:"Mechiras Chametz"
};

const LAG_BAOMER_EVENT:LinkedSpecialEvent={
  key:"lag_baomer_event",
  label:"Lag B'Omer Event"
};

const TIKKUN_LEIL_SHAVUOS:LinkedSpecialEvent={
  key:"tikkun_leil_shavuos",
  label:"Tikkun Leil Shavuos"
};

const TISHA_BAV_PROGRAM:LinkedSpecialEvent={
  key:"tisha_bav_program",
  label:"Tisha B'Av Program"
};

const TU_BAV_PROGRAM:LinkedSpecialEvent={
  key:"tu_bav_program",
  label:"Tu B'Av Program"
};

function normalizeHebrewMonth(value:string){
  const aliases:Record<string,string>={
    Tishri:"Tishrei",
    Heshvan:"Cheshvan",
    Marcheshvan:"Cheshvan",
    Tevet:"Teves",
    Nisan:"Nissan",
    Tamuz:"Tammuz",
    "Adar II":"Adar"
  };
  return aliases[value]||value;
}

function hebrewPartsForDate(date:string){
  const parts=new Intl.DateTimeFormat("en-u-ca-hebrew",{
    day:"numeric",
    month:"long"
  }).formatToParts(new Date(`${date}T12:00:00`));

  return {
    day:Number(parts.find(part=>part.type==="day")?.value||0),
    month:normalizeHebrewMonth(parts.find(part=>part.type==="month")?.value||"")
  };
}

function shiftDate(date:string,days:number){
  const value=new Date(`${date}T12:00:00`);
  value.setDate(value.getDate()+days);
  const y=value.getFullYear();
  const m=String(value.getMonth()+1).padStart(2,"0");
  const d=String(value.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function pushUnique(results:LinkedSpecialEvent[],...items:LinkedSpecialEvent[]){
  const existing=new Set(results.map(item=>item.key));
  for(const item of items){
    if(existing.has(item.key))continue;
    results.push(item);
    existing.add(item.key);
  }
}

export function isChanukahDate(date:string){
  // Chanukah is exactly the eight-day run beginning on 25 Kislev.
  // Looking backward handles years where Kislev has either 29 or 30 days.
  for(let offset=0;offset<8;offset+=1){
    const parts=hebrewPartsForDate(shiftDate(date,-offset));
    if(parts.month==="Kislev"&&parts.day===25)return true;
  }
  return false;
}

export function linkedSpecialEventsForDate(
  date:string,
  context:LinkedSpecialEventContext={}
){
  const parts=hebrewPartsForDate(date);
  const title=(context.title||"").toLowerCase();
  const results:LinkedSpecialEvent[]=[];

  if(parts.month==="Tishrei"&&context.isCholHamoed){
    pushUnique(results,SIMCHAS_BEIS_HASHOEVA);
  }

  if(isChanukahDate(date)){
    pushUnique(results,MENORAH_LIGHTING,CHANUKAH_PARTY);
  }

  if(parts.month==="Shevat"&&parts.day===15){
    pushUnique(results,TU_BISHVAT_PARTY);
  }

  // Purim programming may be held on the observed Ta'anis Esther evening,
  // on 13 Adar (Purim night), or on Purim day.
  if(
    (parts.month==="Adar"&&(parts.day===13||parts.day===14))||
    /taanit esther|taanis esther|fast of esther/.test(title)
  ){
    pushUnique(results,PURIM_PARTY);
  }

  if(/shabbos ha?gadol|shabbat ha?gadol/.test(title)){
    pushUnique(results,SHABBOS_HAGADOL_DRASHA);
  }

  if(
    (parts.month==="Nissan"&&parts.day===14)||
    /erev pesach|erev passover/.test(title)
  ){
    pushUnique(results,SIYUM_BECHORIM,BIUR_CHAMETZ,MECHIRAS_CHAMETZ);
  }

  if(parts.month==="Iyar"&&parts.day===18){
    pushUnique(results,LAG_BAOMER_EVENT);
  }

  if(/erev shavuot|erev shavuos/.test(title)){
    pushUnique(results,TIKKUN_LEIL_SHAVUOS);
  }

  if(/tisha b|tish'a b/.test(title)){
    pushUnique(results,TISHA_BAV_PROGRAM);
  }

  if(parts.month==="Av"&&parts.day===15){
    pushUnique(results,TU_BAV_PROGRAM);
  }

  return results;
}
