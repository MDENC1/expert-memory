export type LinkedSpecialEvent = {
  key:string;
  label:string;
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
  context:{isCholHamoed?:boolean}={}
){
  const month=hebrewPartsForDate(date).month;
  const results:LinkedSpecialEvent[]=[];

  if(month==="Tishrei"&&context.isCholHamoed){
    results.push(SIMCHAS_BEIS_HASHOEVA);
  }

  if(isChanukahDate(date)){
    results.push(MENORAH_LIGHTING,CHANUKAH_PARTY);
  }

  return results;
}
