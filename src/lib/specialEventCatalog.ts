export type LinkedSpecialEvent = {
  key:string;
  label:string;
};

const LINKED_SPECIAL_EVENTS:LinkedSpecialEvent[]=[
  {key:"simchas_beis_hashoeva",label:"Simchas Beis Hashoeva"}
];

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

function hebrewMonthForDate(date:string){
  const parts=new Intl.DateTimeFormat("en-u-ca-hebrew",{month:"long"})
    .formatToParts(new Date(`${date}T12:00:00`));
  return normalizeHebrewMonth(parts.find(part=>part.type==="month")?.value||"");
}

export function linkedSpecialEventsForDate(
  date:string,
  context:{isCholHamoed?:boolean}={}
){
  const month=hebrewMonthForDate(date);
  const results:LinkedSpecialEvent[]=[];

  if(month==="Tishrei"&&context.isCholHamoed){
    results.push(LINKED_SPECIAL_EVENTS[0]);
  }

  return results;
}
