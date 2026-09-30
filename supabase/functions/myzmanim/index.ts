import zipToTzModule from "npm:zip-to-tz@1.1.0";

const zipToTz:any =
  typeof zipToTzModule === "function"
    ? zipToTzModule
    : (zipToTzModule as any)?.default;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const headers = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dateRange(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(start + "T12:00:00Z");
  const last = new Date(end + "T12:00:00Z");
  while (d <= last) {
    out.push(isoDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const countryNames: Record<string,string[]> = {
  US: ["United States","United States of America","USA"],
  GB: ["United Kingdom","Great Britain","UK"],
  IL: ["Israel"],
};

function countryMatches(code:string, returned:string|null|undefined) {
  if (!code || !returned) return true;
  const allowed=countryNames[code];
  return !allowed || allowed.some(name=>name.toLowerCase()===returned.toLowerCase());
}

async function findLocationId(user:string,key:string,postalCode:string) {
  const searchParams = new URLSearchParams({
    User: user,
    Key: key,
    Coding: "JS",
    Query: postalCode,
    TimeZone: "",
  });

  const searchResponse = await fetch(
    "https://api.myzmanim.com/engine1.json.aspx/searchPostal",
    { method: "POST", headers, body: searchParams }
  );
  const searchData = await searchResponse.json();
  if (searchData.ErrMsg) throw new Error(searchData.ErrMsg);
  if (!searchData.LocationID) throw new Error("MyZmanim could not find that postal code.");
  return String(searchData.LocationID);
}

async function getDay(user:string,key:string,locationId:string,date:string) {
  const dayParams = new URLSearchParams({
    User: user,
    Key: key,
    Coding: "JS",
    Language: "en",
    LocationID: locationId,
    InputDate: date,
  });

  let lastError:unknown=null;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response = await fetch(
        "https://api.myzmanim.com/engine1.json.aspx/getDay",
        {
          method: "POST",
          headers,
          body: dayParams,
          signal: AbortSignal.timeout(6000)
        }
      );
      if(!response.ok) throw new Error(`MyZmanim HTTP ${response.status}`);
      const data = await response.json();
      if (data.ErrMsg) throw new Error(data.ErrMsg);
      return data;
    }catch(error){
      lastError=error;
      if(attempt===0)await new Promise(resolve=>setTimeout(resolve,250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("MyZmanim request failed");
}

function resolveTimezone(countryCode:string,postalCode:string) {
  if (countryCode==="GB") return "Europe/London";
  if (countryCode==="IL") return "Asia/Jerusalem";
  if (countryCode==="US") {
    if(typeof zipToTz!=="function"){
      throw new Error("U.S. time zone lookup failed to initialize.");
    }
    const timezone=zipToTz(postalCode);
    if(!timezone) throw new Error("Could not determine the U.S. time zone for that ZIP code.");
    return timezone;
  }
  throw new Error("Time zone lookup is not configured for the selected country.");
}

function cleanPlace(data:any) {
  return {
    name: data?.Place?.NameShort ?? null,
    city: data?.Place?.City ?? null,
    state: data?.Place?.State ?? null,
    country: data?.Place?.Country ?? null,
    postal_code: data?.Place?.PostalCode ?? null,
    location_id: data?.Place?.LocationID ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = Deno.env.get("MYZMANIM_USER");
    const key = Deno.env.get("MYZMANIM_KEY");
    if (!user || !key) throw new Error("MyZmanim credentials are missing.");

    const body = await req.json();
    const action = String(body.action || "times");
    const postalCode = String(body.postal_code || "").trim();
    const countryCode = String(body.country_code || "").toUpperCase();
    let locationId = body.location_id ? String(body.location_id) : "";

    if(action==="resolve_location"){
      if(!postalCode) throw new Error("Postal code is required.");
      locationId=await findLocationId(user,key,postalCode);
      const today=isoDate(new Date());
      const day=await getDay(user,key,locationId,today);
      const returnedCountry=day?.Place?.Country ?? null;
      if(!countryMatches(countryCode,returnedCountry)){
        throw new Error(`Postal code matched ${returnedCountry}, not the selected country.`);
      }
      const place=cleanPlace(day);
      const timezone=resolveTimezone(countryCode,postalCode);
      return new Response(JSON.stringify({
        success:true,
        source:"MyZmanim",
        verified:true,
        location_id:locationId,
        place,
        timezone,
      }),{
        status:200,
        headers:{...corsHeaders,"Content-Type":"application/json"},
      });
    }

    const singleDate = body.date ? String(body.date) : "";
    const startDate = body.start_date ? String(body.start_date) : singleDate;
    const endDate = body.end_date ? String(body.end_date) : singleDate;

    if (!startDate || !endDate) throw new Error("date or start_date/end_date is required.");

    if (!locationId) {
      if (!postalCode) throw new Error("postal_code or location_id is required.");
      locationId = await findLocationId(user,key,postalCode);
    }

    const dates = dateRange(startDate, endDate);
    if (dates.length > 45) throw new Error("Date range is too large.");

    const plagHaMincha: Record<string, string> = {};
    const sunset: Record<string, string> = {};
    const candleLighting: Record<string, string> = {};
    const sunrise: Record<string, string> = {};
    const latestShema: Record<string, string> = {};
    const midday: Record<string, string> = {};
    const sources: Record<string, Record<string,string>> = {};
    const sourceFields: Record<string,string> = {
      dawn_72fix: "Dawn72fix",
      dawn_benish: "DawnBenIsh72ToGra180propdn",
      sunrise_default: "SunriseDefault",
      shema_gra: "ShemaGra",
      shema_benish: "ShemaBenIsh72ToGra180",
      shema_ma72fix: "ShemaMA72fix",
      midday: "Midday",
      midday_benish: "MiddayBenIsh72proprsToRaful",
      mincha_gra: "MinchaGra",
      mincha_benish: "MinchaBenIsh72ToShabbos",
      mincha_ma72fix: "MinchaMA72fix",
      ketana_gra: "KetanaGra",
      ketana_benish: "KetanaBenIsh72ToShabbos",
      ketana_ma72fix: "KetanaMA72fix",
      plag_gra: "PlagGra",
      plag_benish: "PlagBenIsh72ToShabbos",
      plag_ma72fix: "PlagMA72fix",
      sunset_default: "SunsetDefault",
      night_gra180: "NightGra180",
      night_benish: "NightBenIsh72ToGra180propdn",
      night_72fix: "Night72fix"
    };
    for (const key of Object.keys(sourceFields)) sources[key] = {};
    let place: Record<string, unknown> | null = null;

    const results:Array<{date:string;data:any}>=[];

    // Keep MyZmanim traffic bounded. The admin UI can ask for a month of
    // dates, and React development mode may issue duplicate requests.
    // Small batches prevent a browser refresh from turning into dozens of
    // simultaneous upstream calls.
    const batchSize=4;
    for(let i=0;i<dates.length;i+=batchSize){
      const batch=dates.slice(i,i+batchSize);
      const batchResults=await Promise.all(batch.map(async (date) => {
        try{
          const data=await getDay(user,key,locationId,date);
          return {date,data};
        }catch(error){
          throw new Error(`${date}: ${error instanceof Error?error.message:"MyZmanim error"}`);
        }
      }));
      results.push(...batchResults);
      if(i+batchSize<dates.length)await new Promise(resolve=>setTimeout(resolve,75));
    }

    for (const { date, data } of results) {
      if (!place) {
        const returnedCountry = data?.Place?.Country ?? null;
        if (!countryMatches(countryCode,returnedCountry)) {
          throw new Error(`Postal code matched ${returnedCountry}, not the selected country.`);
        }
        place = cleanPlace(data);
      }

      if (data?.Zman?.PlagGra) plagHaMincha[date] = data.Zman.PlagGra;
      if (data?.Zman?.SunsetDefault) sunset[date] = data.Zman.SunsetDefault;
      if (data?.Zman?.SunriseDefault) sunrise[date] = data.Zman.SunriseDefault;
      if (data?.Zman?.ShemaGra) latestShema[date] = data.Zman.ShemaGra;
      if (data?.Zman?.Midday) midday[date] = data.Zman.Midday;

      for (const [key,field] of Object.entries(sourceFields)) {
        const value = data?.Zman?.[field];
        if (value && value !== "0001-01-01T00:00:00Z") sources[key][date] = value;
      }

      const candleMinutes = data?.Place?.CandlelightingMinutes;
      const candleField = candleMinutes ? `Candles${candleMinutes}` : null;
      if (candleField && data?.Zman?.[candleField]) candleLighting[date] = data.Zman[candleField];
    }

    return new Response(JSON.stringify({
      success: true,
      source: "MyZmanim",
      location_id: locationId,
      place,
      times: { plagHaMincha, sunset, sunrise, latestShema, midday, candleLighting, sources },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("MyZmanim function error:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
