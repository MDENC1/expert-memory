function partsForDate(value:string|Date){
  const date=typeof value==="string"
    ?new Date(`${value}T12:00:00`)
    :value;
  const parts=new Intl.DateTimeFormat("en-u-ca-hebrew",{
    day:"numeric",
    month:"long"
  }).formatToParts(date);

  const rawMonth=parts.find(part=>part.type==="month")?.value||"";
  const aliases:Record<string,string>={
    Nisan:"Nissan",
    Tevet:"Teves",
    Tishri:"Tishrei",
    Tamuz:"Tammuz",
    "Adar II":"Adar"
  };

  return {
    day:Number(parts.find(part=>part.type==="day")?.value||0),
    month:aliases[rawMonth]||rawMonth
  };
}

export function omerTextForDate(value:string|Date){
  const {day,month}=partsForDate(value);

  // The first count happens on the second Seder night, while the daytime
  // Hebrew date is still 15 Nissan.
  if(month==="Nissan"&&day===15){
    return "Tonight: Sefiras HaOmer · Day 1";
  }

  let omerDay=0;
  if(month==="Nissan"&&day>=16){
    omerDay=day-15;
  }else if(month==="Iyar"){
    omerDay=15+day;
  }else if(month==="Sivan"&&day<=5){
    omerDay=44+day;
  }

  return omerDay>=1&&omerDay<=49
    ?`Sefiras HaOmer · Day ${omerDay}`
    :"";
}

export function isSederChatzosDate(value:string|Date){
  const {day,month}=partsForDate(value);
  // 14 Nissan evening = first Seder; 15 Nissan evening = second Seder.
  return month==="Nissan"&&(day===14||day===15);
}
