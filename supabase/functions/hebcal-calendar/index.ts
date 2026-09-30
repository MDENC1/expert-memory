const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CalendarItem = {
  title?: string;
  date?: string;
  hdate?: string;
  hebrew?: string;
  category?: string;
  subcat?: string;
  yomtov?: boolean;
};

type SpecialEvent = {
  date:string;
  title:string;
  hdate:string|null;
  hebrew:string|null;
  group_key:string;
  group_label:string;
  lead_days:number;
  blocks_regular_schedule:boolean;
  requires_confirmation:boolean;
  yomtov:boolean;
  subcat:string|null;
  is_chol_hamoed:boolean;
};

function normalizeTitle(value:string){
  return value
    .toLowerCase()
    .replace(/[’‘”“"']/g,"")
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function classify(item:CalendarItem):Omit<SpecialEvent,"date"|"title"|"hdate"|"hebrew"|"yomtov"|"subcat">|null{
  const raw=String(item.title||"");
  const t=normalizeTitle(raw);
  const isCholHamoed=/chol ha moed|ch m/.test(t);
  const isHoshana=/hoshana rab/.test(t);
  const isFast=/tzom gedalia|asara b tevet|tevet.*fast|taanit esther|fast of esther|17th of tammuz|tzom tammuz|tisha b av|tish a b av/.test(t);

  if(/leil selichot|selichot|selichos/.test(t)){
    return {
      group_key:"selichos",
      group_label:"Selichos",
      lead_days:14,
      blocks_regular_schedule:false,
      requires_confirmation:true
    };
  }

  if(/rosh hashana|yom kippur|sukkot|succot|shmini atzeret|shemini atzeret|shemini atzeres|simchat torah|simchas torah|tzom gedalia/.test(t)){
    const isErev=t.startsWith("erev ");
    return {
      group_key:"tishrei",
      group_label:"Tishrei / High Holidays",
      lead_days:30,
      blocks_regular_schedule:Boolean(item.yomtov)||isCholHamoed||isHoshana||/yom kippur|tzom gedalia/.test(t),
      requires_confirmation:!isErev
    };
  }

  if(/pesach|passover/.test(t)){
    const isErev=t.startsWith("erev ");
    return {
      group_key:"pesach",
      group_label:"Pesach & Chol Hamoed",
      lead_days:30,
      blocks_regular_schedule:Boolean(item.yomtov)||isCholHamoed,
      requires_confirmation:!isErev
    };
  }

  if(/shavuot|shavuos/.test(t)){
    const isErev=t.startsWith("erev ");
    return {
      group_key:"shavuos",
      group_label:"Shavuos",
      lead_days:28,
      blocks_regular_schedule:Boolean(item.yomtov),
      requires_confirmation:!isErev
    };
  }

  if(/purim/.test(t) && !/purim katan/.test(t)){
    return {
      group_key:"purim",
      group_label:"Purim",
      lead_days:21,
      blocks_regular_schedule:false,
      requires_confirmation:true
    };
  }

  if(isFast){
    return {
      group_key:"fast_days",
      group_label:"Fast Day Schedule",
      lead_days:14,
      blocks_regular_schedule:true,
      requires_confirmation:true
    };
  }

  if(item.yomtov){
    return {
      group_key:"other_yom_tov",
      group_label:"Upcoming Yom Tov",
      lead_days:28,
      blocks_regular_schedule:true,
      requires_confirmation:true
    };
  }

  return null;
}

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS"){
    return new Response("ok",{headers:corsHeaders});
  }

  try{
    const body=await req.json();
    const start=String(body.start_date||"").trim();
    const end=String(body.end_date||"").trim();
    const countryCode=String(body.country_code||"US").trim().toUpperCase();

    if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)){
      throw new Error("start_date and end_date are required in YYYY-MM-DD format.");
    }

    const startDate=new Date(start+"T12:00:00Z");
    const endDate=new Date(end+"T12:00:00Z");
    const daySpan=Math.ceil((endDate.getTime()-startDate.getTime())/86400000);
    if(daySpan<0||daySpan>370)throw new Error("Hebcal date range must be between 0 and 370 days.");

    const params=new URLSearchParams({
      v:"1",
      cfg:"json",
      maj:"on",
      min:"on",
      mf:"on",
      start,
      end,
      i:countryCode==="IL"?"on":"off",
      lg:"s"
    });

    const response=await fetch("https://www.hebcal.com/hebcal?"+params.toString(),{
      headers:{
        "Accept":"application/json",
        "User-Agent":"Magnets/0.1 special-schedule-calendar"
      },
      signal:AbortSignal.timeout(8000)
    });

    if(!response.ok)throw new Error(`Hebcal HTTP ${response.status}`);
    const payload=await response.json();
    const items:Array<CalendarItem>=Array.isArray(payload?.items)?payload.items:[];

    const events:SpecialEvent[]=items.flatMap(item=>{
      if(item.category!=="holiday"||!item.date||!item.title)return [];
      const classified=classify(item);
      if(!classified)return [];
      return [{
        date:String(item.date).slice(0,10),
        title:String(item.title),
        hdate:item.hdate?String(item.hdate):null,
        hebrew:item.hebrew?String(item.hebrew):null,
        yomtov:Boolean(item.yomtov),
        subcat:item.subcat?String(item.subcat):null,
        is_chol_hamoed:/chol ha moed|ch m/.test(normalizeTitle(String(item.title||""))),
        ...classified
      }];
    });

    return new Response(JSON.stringify({
      success:true,
      source:"Hebcal",
      israel:countryCode==="IL",
      events
    }),{
      status:200,
      headers:{
        ...corsHeaders,
        "Content-Type":"application/json",
        "Cache-Control":"public, max-age=3600"
      }
    });
  }catch(error){
    console.error("Hebcal calendar error:",error instanceof Error?error.message:error);
    return new Response(JSON.stringify({
      success:false,
      error:error instanceof Error?error.message:"Unknown Hebcal error"
    }),{
      status:200,
      headers:{...corsHeaders,"Content-Type":"application/json"}
    });
  }
});
